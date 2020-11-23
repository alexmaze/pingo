import {
  Controller,
  Get,
  Body,
  Inject,
  Param,
  Delete,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  Req,
  Put,
  Res,
  HttpStatus
} from "@nestjs/common"
import { OrderEntity, OrderStatus, IProduct } from "../main/order.entity"
import { AuthGuard } from "@nestjs/passport"
import { OrderService } from "../main/order.service"
import { IRequest } from "./interfaces"
import { ProductService } from "../main/product.service"
import { ProductMemberService } from "../main/product_member.service"
import { ProductEntity } from "../main/product.entity"
import { WechatService } from "./wechat.service"
import { Response } from "express"

@Controller("/api/wechat/order")
export class OrderController {
  @Inject()
  orderServ: OrderService

  @Inject()
  wechatServ: WechatService

  @Inject()
  productServ: ProductService

  @Inject()
  productMemberServ: ProductMemberService

  @Get("/")
  @UseGuards(AuthGuard())
  async list(
    @Req() request: IRequest,
    @Query()
    query: { skip: number; limit: number }
  ) {
    const orders = await this.orderServ.listByUserId(
      request.user.id,
      query.skip,
      query.limit
    )

    const res = []

    for (const o of orders) {
      const total = await this.productMemberServ.sumNumberByOrderId(o.id)
      res.push({
        ...o,
        total: parseFloat(total.toFixed(4))
      })
    }

    return res
  }

  @Post("/")
  @UseGuards(AuthGuard())
  async create(
    @Req() request: IRequest,
    @Res() response: Response,
    @Body() data: OrderEntity
  ) {
    try {
      const msgCheck = JSON.stringify(data)
      await this.wechatServ.msgSecCheck(msgCheck)
    } catch (err) {
      response.status(HttpStatus.BAD_REQUEST).send("含违规内容，请修改后重试")
      return
    }

    try {
      await this.orderServ.create(request.user, data)
    } catch (err) {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).send(err)
      return
    }

    response.status(HttpStatus.CREATED).send()
    return
  }

  @Post("/join")
  @UseGuards(AuthGuard())
  join(@Req() request: IRequest, @Body() data: { code: string }) {
    return this.orderServ.join(request.user, data.code)
  }

  @Get("/:id")
  @UseGuards(AuthGuard())
  async show(@Req() request: IRequest, @Param("id", ParseIntPipe) id: number) {
    const order = await this.orderServ.show(id)

    if (!order.members.find(v => v.id === request.user.id)) {
      // 如果这个人不在这个订单中，自动加入订单
      await this.orderServ.addMember(id, request.user)
    }

    return order
  }

  @Get("/:id/export")
  @UseGuards(AuthGuard())
  async export(
    @Param("id", ParseIntPipe) id: number,
    @Res() response: Response
  ) {
    const order = await this.orderServ.show(id)

    const csv = []
    csv.push(["ID", order.id].join(","))
    csv.push(["主题", order.title].join(","))
    csv.push(["拼单号", order.share_code].join(","))
    csv.push(["发起时间", order.created_at.toLocaleDateString()].join(","))
    csv.push(["发起人", order.creator.name].join(","))
    csv.push("")
    csv.push("")

    {
      const table = []
      const members = order.members
      const products = order.products
      const lineOffset = 6 // 前6行保留给商品信息
      const columnOffset = 1 // 第1列保留给成员名称

      // 初始化商品信息行
      table[0] = ["商品"]
      table[1] = ["描述"]
      table[2] = ["单价"]
      table[3] = ["总数"]
      table[4] = ["总价"]
      table[5] = []

      // 初始化行，成员
      for (let i = 0; i < members.length; i++) {
        const index = i + lineOffset
        const m = members[i]

        table[index] = []
        table[index][0] = m.name || `未认证${m.wx_open_id}`
      }

      // 初始化列，商品
      for (let i = 0; i < products.length; i++) {
        const index = i + columnOffset
        const p = products[i] as any

        table[0][index] = p.name
        table[1][index] = p.desc
        table[2][index] = p.unit_price

        let totalNumber = 0
        let totalPrice = 0

        for (const m of p.members) {
          // 成员在 table 中行号
          const mIndex =
            members.findIndex(v => v.id === m.account.id) + lineOffset
          table[mIndex][index] = m.buy_number

          totalNumber += m.buy_number
          totalPrice += m.buy_number * p.unit_price
        }

        table[3][index] = parseFloat(totalNumber.toFixed(4))
        table[4][index] = parseFloat(totalPrice.toFixed(4))
      }

      for (const line of table) {
        if (line.filter((_, i) => i !== 0).length === 0) {
          continue
        }

        csv.push(line.join(","))
      }
    }

    response
      .status(HttpStatus.OK)
      .contentType("application/csv;charset=utf-8")
      .send(csv.join("\n"))
  }

  @Put("/:id")
  @UseGuards(AuthGuard())
  async update(
    @Res() response: Response,
    @Param("id", ParseIntPipe) id,
    @Body() data: OrderEntity
  ) {
    try {
      const msgCheck = JSON.stringify(data)
      await this.wechatServ.msgSecCheck(msgCheck)
    } catch (err) {
      response.status(HttpStatus.BAD_REQUEST).send("含违规内容，请修改后重试")
      return
    }

    try {
      data.id = id
      await this.orderServ.update(data)
    } catch (err) {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).send(err)
      return
    }

    response.status(HttpStatus.OK).send()
    return
  }

  @Delete("/:id")
  @UseGuards(AuthGuard())
  remove(@Param("id", ParseIntPipe) id) {
    return this.orderServ.remove(id)
  }

  @Post("/:id/close")
  @UseGuards(AuthGuard())
  async close(@Param("id", ParseIntPipe) id) {
    const m = await this.orderServ.show(id)
    m.status = OrderStatus.Closed
    return this.orderServ.update(m)
  }

  // 订单商品
  @Post("/:id/product")
  @UseGuards(AuthGuard())
  async addProduct(
    @Res() response: Response,
    @Param("id", ParseIntPipe) id: number,
    @Body() data: ProductEntity
  ) {
    try {
      const msgCheck = JSON.stringify(data)
      await this.wechatServ.msgSecCheck(msgCheck)
    } catch (err) {
      console.log(err)
      response.status(HttpStatus.BAD_REQUEST).send("含违规内容，请修改后重试")
      return
    }

    // data.select_mode = "float"
    try {
      await this.productServ.create(id, data)
    } catch (err) {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).send(err)
      return
    }

    response.status(HttpStatus.OK).send()
    return
  }

  @Put("/:id/product/:productId")
  @UseGuards(AuthGuard())
  async updateProduct(
    @Res() response: Response,
    @Param("id", ParseIntPipe) id: number,
    @Param("productId", ParseIntPipe) productId: number,
    @Body() data: ProductEntity
  ) {
    try {
      const msgCheck = JSON.stringify(data)
      await this.wechatServ.msgSecCheck(msgCheck)
    } catch (err) {
      response.status(HttpStatus.BAD_REQUEST).send("含违规内容，请修改后重试")
      return
    }

    data.id = productId
    try {
      await this.productServ.update(data)
    } catch (err) {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).send(err)
      return
    }

    response.status(HttpStatus.OK).send()
    return
  }

  @Delete("/:id/product/:productId")
  @UseGuards(AuthGuard())
  removeProduct(
    @Param("id", ParseIntPipe) id: number,
    @Param("productId", ParseIntPipe) productId: number
  ) {
    return this.productServ.remove(productId)
  }

  // 用户商品订单信息
  @Put("/:id/product/:productId/member")
  @UseGuards(AuthGuard())
  updateUserProductInfo(
    @Req() request: IRequest,
    @Param("id", ParseIntPipe) id: number,
    @Param("productId", ParseIntPipe) productId: number,
    @Body() data: { buy_number: number }
  ) {
    if (data.buy_number === 0) {
      return this.productMemberServ.remove(productId, request.user.id)
    }

    return this.productMemberServ.createOrUpdate(
      id,
      productId,
      request.user.id,
      data.buy_number
    )
  }

  // 用户商品订单信息
  @Delete("/:id/product/:productId/member")
  @UseGuards(AuthGuard())
  removeUserProductInfo(
    @Req() request: IRequest,
    @Param("id", ParseIntPipe) id: number,
    @Param("productId", ParseIntPipe) productId: number
  ) {
    return this.productMemberServ.remove(productId, request.user.id)
  }
}
