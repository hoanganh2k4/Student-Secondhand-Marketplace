"""
src/utils/__init__.py
Shared utilities: config loading, logging setup, device resolution.
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Any

import yaml


# ── Config ────────────────────────────────────────────────────────────────────

class Config:
    """
    Thin wrapper around a YAML config dict.
    Supports nested attribute access: cfg.model.text_dim
    """

    def __init__(self, data: dict[str, Any]):
        for key, value in data.items():
            setattr(self, key, Config(value) if isinstance(value, dict) else value)

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)

    def to_dict(self) -> dict[str, Any]:
        result = {}
        for key, value in self.__dict__.items():
            result[key] = value.to_dict() if isinstance(value, Config) else value
        return result

    def __repr__(self) -> str:
        return f"Config({self.to_dict()})"


def load_config(path: str | Path = "configs/config.yaml") -> Config:
    """Load YAML config file and return Config object."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    with open(path) as f:
        data = yaml.safe_load(f)
    return Config(data)


# ── Logger ────────────────────────────────────────────────────────────────────

def get_logger(name: str, level: str = "INFO", log_dir: str | None = None) -> logging.Logger:
    """
    Create a logger with console + optional file handler.

    Args:
        name: Logger name (usually __name__ of caller module).
        level: Logging level string.
        log_dir: If provided, also write logs to {log_dir}/{name}.log.
    """
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger  # already configured

    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Console handler
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    logger.addHandler(ch)

    # File handler (optional)
    if log_dir:
        os.makedirs(log_dir, exist_ok=True)
        fh = logging.FileHandler(Path(log_dir) / f"{name.replace('.', '_')}.log")
        fh.setFormatter(fmt)
        logger.addHandler(fh)

    return logger


# ── Device ────────────────────────────────────────────────────────────────────

def get_device() -> "torch.device":  # type: ignore[name-defined]  # noqa: F821
    """Return best available device: CUDA > MPS > CPU."""
    import torch  # lazy import so utils can be imported without torch if needed

    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")
