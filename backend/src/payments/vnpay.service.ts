import { Injectable, Logger } from '@nestjs/common'
import { ConfigService }      from '@nestjs/config'
import * as crypto            from 'crypto'
import * as qs                from 'qs'
import axios                  from 'axios'

@Injectable()
export class VnpayService {
  private readonly logger = new Logger(VnpayService.name)

  private readonly tmnCode:    string
  private readonly hashSecret: string
  private readonly paymentUrl: string
  private readonly queryUrl:   string
  private readonly refundUrl:  string

  constructor(private readonly config: ConfigService) {
    this.tmnCode    = config.get('DEV_VNPAY_TMN_CODE')!
    this.hashSecret = config.get('DEV_VNPAY_HASH_SECRET')!
    this.paymentUrl = config.get('DEV_VNPAY_PAYMENT_URL')!
    this.queryUrl   = config.get('DEV_VNPAY_QUERY_URL')!
    this.refundUrl  = config.get('DEV_VNPAY_REFUND_URL')!
  }

  private sign(data: string): string {
    return crypto.createHmac('sha512', this.hashSecret).update(data, 'utf-8').digest('hex')
  }

  private sortObject(obj: Record<string, any>): Record<string, any> {
    return Object.keys(obj).sort().reduce((acc, k) => ({ ...acc, [k]: obj[k] }), {} as Record<string, any>)
  }

  createPaymentUrl(opts: {
    orderId:     string
    amount:      number
    orderInfo:   string
    returnUrl:   string
    ipAddr:      string
    createDate:  string
  }): string {
    const { orderId, amount, orderInfo, returnUrl, ipAddr, createDate } = opts

    const params: Record<string, any> = {
      vnp_Version:    '2.1.0',
      vnp_Command:    'pay',
      vnp_TmnCode:    this.tmnCode,
      vnp_Amount:     amount * 100,        // VNPay nhân 100
      vnp_CreateDate: createDate,
      vnp_CurrCode:   'VND',
      vnp_IpAddr:     ipAddr,
      vnp_Locale:     'vn',
      vnp_OrderInfo:  orderInfo,
      vnp_OrderType:  'other',
      vnp_ReturnUrl:  returnUrl,
      vnp_TxnRef:     orderId,
    }

    const sorted    = this.sortObject(params)
    const signData  = qs.stringify(sorted, { encode: false })
    const signature = this.sign(signData)

    return `${this.paymentUrl}?${signData}&vnp_SecureHash=${signature}`
  }

  verifyIpn(query: Record<string, any>): boolean {
    const { vnp_SecureHash, ...rest } = query
    const sorted   = this.sortObject(rest)
    const signData = qs.stringify(sorted, { encode: false })
    const expected = this.sign(signData)
    return expected === vnp_SecureHash
  }

  async refund(opts: {
    orderId:      string
    transDate:    string
    amount:       number
    desc:         string
    ipAddr:       string
    createDate:   string
    transType:    '02' | '03'   // 02 = full, 03 = partial
  }): Promise<void> {
    const { orderId, transDate, amount, desc, ipAddr, createDate, transType } = opts

    const params: Record<string, any> = {
      vnp_RequestId:      orderId + '_refund',
      vnp_Version:        '2.1.0',
      vnp_Command:        'refund',
      vnp_TmnCode:        this.tmnCode,
      vnp_TransactionType: transType,
      vnp_TxnRef:         orderId,
      vnp_Amount:         amount * 100,
      vnp_TransactionDate: transDate,
      vnp_CreateBy:       'system',
      vnp_CreateDate:     createDate,
      vnp_IpAddr:         ipAddr,
      vnp_OrderInfo:      desc,
    }

    const signData  = qs.stringify(this.sortObject(params), { encode: false })
    params['vnp_SecureHash'] = this.sign(signData)

    const { data } = await axios.post(this.refundUrl, params)
    this.logger.log(`VNPay refund response: ${JSON.stringify(data)}`)

    if (data.vnp_ResponseCode !== '00') {
      throw new Error(`VNPay refund error: ${data.vnp_Message}`)
    }
  }
}
