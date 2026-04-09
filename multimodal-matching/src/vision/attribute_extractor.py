"""
Florence-2-base attribute extractor.

Extracts structured attributes from product images using Microsoft's Florence-2-base
(232M params, CPU-friendly, no GPU required for inference at MVP scale).

Supported tasks
---------------
- caption          : Short product description  (<CAPTION>)
- detailed_caption : Longer description         (<DETAILED_CAPTION>)
- ocr              : Text found in the image    (<OCR>)
- object_detection : Bounding boxes + labels    (<OD>)
- dense_caption    : Region-level captions      (<DENSE_REGION_CAPTION>)

Usage
-----
extractor = FlorenceAttributeExtractor()
attrs = extractor.extract(image_url, tasks=["caption", "ocr"])
# {"caption": "Blue MacBook Pro laptop ...", "ocr": "MacBook Pro"}
"""
from __future__ import annotations

import io
import logging
from functools import lru_cache
from typing import Dict, List, Optional, Union

import requests
import torch
from PIL import Image
from transformers import AutoModelForCausalLM, AutoProcessor

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "microsoft/Florence-2-base"
_TASK_PROMPTS: Dict[str, str] = {
    "caption":          "<CAPTION>",
    "detailed_caption": "<DETAILED_CAPTION>",
    "ocr":              "<OCR>",
    "object_detection": "<OD>",
    "dense_caption":    "<DENSE_REGION_CAPTION>",
}
_TIMEOUT_SEC = 10


class FlorenceAttributeExtractor:
    """
    Wraps Florence-2-base to extract structured attributes from product images.

    Parameters
    ----------
    model_name : str
        HuggingFace model ID.  Defaults to microsoft/Florence-2-base.
    device : str | None
        'cuda', 'cpu', or None (auto-detect).
    cache_dir : str | None
        Where to store downloaded model weights.
    dtype : torch.dtype
        Model dtype.  float16 on CUDA for speed, float32 on CPU.
    """

    def __init__(
        self,
        model_name: str = _DEFAULT_MODEL,
        device: Optional[str] = None,
        cache_dir: Optional[str] = None,
        dtype: Optional[torch.dtype] = None,
    ) -> None:
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")

        if dtype is None:
            dtype = torch.float16 if self.device == "cuda" else torch.float32
        self.dtype = dtype

        logger.info("Loading %s on %s (dtype=%s) …", model_name, self.device, dtype)

        self.processor = AutoProcessor.from_pretrained(
            model_name,
            trust_remote_code=True,
            cache_dir=cache_dir,
        )
        self.model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=dtype,
            trust_remote_code=True,
            cache_dir=cache_dir,
            attn_implementation="eager",
        )
        self.model.to(self.device)
        # Tie lm_head → embedding weights (checkpoint doesn't save lm_head separately)
        self.model.tie_weights()
        self.model.eval()

        logger.info("Florence-2-base ready.")

    # ── Public API ─────────────────────────────────────────────────────────────

    def extract(
        self,
        image_source: Union[str, Image.Image],
        tasks: Optional[List[str]] = None,
    ) -> Dict[str, str]:
        """
        Run one or more Florence-2 tasks on an image.

        Parameters
        ----------
        image_source : str or PIL.Image
            URL, file path, or already-loaded PIL image.
        tasks : list of str
            Which tasks to run.  Defaults to ["caption", "ocr"].
            Valid: caption, detailed_caption, ocr, object_detection, dense_caption.

        Returns
        -------
        dict
            {task_name: result_string}
        """
        if tasks is None:
            tasks = ["caption", "ocr"]

        image = self._load_image(image_source)
        results: Dict[str, str] = {}

        for task in tasks:
            if task not in _TASK_PROMPTS:
                logger.warning("Unknown task '%s', skipping.", task)
                continue
            try:
                results[task] = self._run_task(image, task)
            except Exception as exc:
                logger.warning("Florence-2 task '%s' failed: %s", task, exc)
                results[task] = ""

        return results

    def extract_batch(
        self,
        image_sources: List[Union[str, Image.Image]],
        tasks: Optional[List[str]] = None,
    ) -> List[Dict[str, str]]:
        """
        Run tasks on multiple images.  Processes sequentially (Florence-2 is
        auto-regressive; batching is rarely beneficial vs. memory cost).
        """
        return [self.extract(src, tasks) for src in image_sources]

    def build_listing_context(self, image_url: str) -> str:
        """
        Convenience method: returns a single string combining caption + OCR
        suitable for injection into the FAISS text index for a listing.
        """
        attrs = self.extract(image_url, tasks=["detailed_caption", "ocr"])
        parts = [v for v in attrs.values() if v.strip()]
        return " | ".join(parts)

    # ── Internal helpers ───────────────────────────────────────────────────────

    @torch.no_grad()
    def _run_task(self, image: Image.Image, task: str) -> str:
        prompt  = _TASK_PROMPTS[task]
        inputs  = self.processor(
            text=prompt,
            images=image,
            return_tensors="pt",
        ).to(self.device, self.dtype)

        # Force legacy tuple cache format — Florence-2 internals don't support
        # the new EncoderDecoderCache object introduced in transformers ≥ 4.41
        self.model._supports_cache_class = False
        if hasattr(self.model, 'language_model'):
            self.model.language_model._supports_cache_class = False

        generated = self.model.generate(
            input_ids=inputs["input_ids"],
            pixel_values=inputs["pixel_values"],
            max_new_tokens=256,
            num_beams=3,
            do_sample=False,
        )
        if hasattr(generated, 'sequences'):
            generated = generated.sequences

        raw = self.processor.batch_decode(generated, skip_special_tokens=False)[0]
        parsed = self.processor.post_process_generation(
            raw,
            task=prompt,
            image_size=(image.width, image.height),
        )

        # Florence-2 returns a dict keyed by the prompt token
        if isinstance(parsed, dict):
            val = parsed.get(prompt, "")
            if isinstance(val, dict):
                # OD result: {"bboxes": [...], "labels": [...]}
                labels = val.get("labels", [])
                return ", ".join(labels) if labels else ""
            return str(val).strip()

        return str(parsed).strip()

    def _load_image(self, source: Union[str, Image.Image]) -> Image.Image:
        if isinstance(source, Image.Image):
            return source.convert("RGB")
        return _fetch_image(source)


@lru_cache(maxsize=64)
def _fetch_image(url: str) -> Image.Image:
    if url.startswith(("http://", "https://")):
        resp = requests.get(url, timeout=_TIMEOUT_SEC)
        resp.raise_for_status()
        return Image.open(io.BytesIO(resp.content)).convert("RGB")
    return Image.open(url).convert("RGB")
