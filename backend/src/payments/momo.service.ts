import { Injectable, Logger } from '@nestjs/common'
import { ConfigService }      from '@nestjs/config'
import * as crypto            from 'crypto'
import axios                  from 'axios'

@Injectable()
export class MomoService {
  private readonly logger = new Logger(MomoService.name)

  private readonly endpoint:    string
  private readonly partnerCode: string
  private readonly accessKey:   string
  private readonly secretKey:   string

  constructor(private readonly config: ConfigService) {
    this.endpoint    = config.get('DEV_MOMO_ENDPOINT')!
    this.partnerCode = config.get('DEV_PARTNER_CODE')!
    this.accessKey   = config.get('DEV_ACCESS_KEY')!
    this.secretKey   = config.get('DEV_SECRET_KEY')!
  }

  private sign(raw: string): string {
    return crypto.createHmac('sha256', this.secretKey).update(raw).digest('hex')
  }

  async createPayment(opts: {
    orderId:     string
    requestId:   string
    amount:      number
    orderInfo:   string
    redirectUrl: string
    ipnUrl:      string
  }): Promise<{ payUrl: string; deeplink: string }> {
    const { orderId, requestId, amount, orderInfo, redirectUrl, ipnUrl } = opts
    const extraData   = ''
    const requestType = 'payWithATM'

    const rawSignature =
      `accessKey=${this.accessKey}` +
      `&amount=${amount}` +
      `&extraData=${extraData}` +
      `&ipnUrl=${ipnUrl}` +
      `&orderId=${orderId}` +
      `&orderInfo=${orderInfo}` +
      `&partnerCode=${this.partnerCode}` +
      `&redirectUrl=${redirectUrl}` +
      `&requestId=${requestId}` +
      `&requestType=${requestType}`

    const signature = this.sign(rawSignature)

    const body = {
      partnerCode: this.partnerCode,
      requestType, redirectUrl, ipnUrl,
      orderId, requestId, amount, orderInfo, extraData, signature,
      lang: 'vi',
    }

    const { data } = await axios.post(`${this.endpoint}/create`, body)
    this.logger.log(`MoMo create response: resultCode=${data.resultCode}`)

    if (data.resultCode !== 0) {
      throw new Error(`MoMo error ${data.resultCode}: ${data.message}`)
    }

    return { payUrl: data.payUrl, deeplink: data.deeplink ?? '' }
  }

  verifyIpn(body: Record<string, any>): boolean {
    const {
      amount, extraData, message, orderId, orderInfo,
      orderType, partnerCode, payType, requestId, responseTime,
      resultCode, transId, signature,
    } = body

    // Use our stored accessKey — MoMo sandbox IPN does not include accessKey in body
    const raw =
      `accessKey=${this.accessKey}` +
      `&amount=${amount}` +
      `&extraData=${extraData}` +
      `&message=${message}` +
      `&orderId=${orderId}` +
      `&orderInfo=${orderInfo}` +
      `&orderType=${orderType}` +
      `&partnerCode=${partnerCode}` +
      `&payType=${payType}` +
      `&requestId=${requestId}` +
      `&responseTime=${responseTime}` +
      `&resultCode=${resultCode}` +
      `&transId=${transId}`

    const expected = this.sign(raw)
    return expected === signature
  }

  async refund(opts: {
    orderId:   string
    requestId: string
    transId:   string
    amount:    number
    desc:      string
  }): Promise<void> {
    const { orderId, requestId, transId, amount, desc } = opts

    const rawSignature =
      `accessKey=${this.accessKey}` +
      `&amount=${amount}` +
      `&description=${desc}` +
      `&orderId=${orderId}` +
      `&partnerCode=${this.partnerCode}` +
      `&requestId=${requestId}` +
      `&transId=${transId}`

    const signature = this.sign(rawSignature)

    const body = {
      partnerCode: this.partnerCode,
      orderId, requestId, amount, transId,
      description: desc,
      lang: 'vi',
      signature,
    }

    const { data } = await axios.post(`${this.endpoint}/refund`, body)
    this.logger.log(`MoMo refund response: resultCode=${data.resultCode}`)

    if (data.resultCode !== 0) {
      throw new Error(`MoMo refund error ${data.resultCode}: ${data.message}`)
    }
  }
}
