import {
  Injectable,
  NotFoundException,
  InternalServerErrorException
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { ProductEntity } from "./product.entity"
import { getManager } from "typeorm"

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly repo: Repository<ProductEntity>
  ) {}

  async create(orderId: number, product: ProductEntity) {
    try {
      await getManager().transaction(async em => {
        const p = new ProductEntity()
        p.name = product.name
        p.select_mode = product.select_mode
        p.unit_price = product.unit_price
        p.desc = product.desc
        p.order = { id: orderId } as any
        p.created_at = new Date()
        p.updated_at = new Date()
        await em.save(p)
      })
    } catch (err) {
      console.error(err)
      throw new InternalServerErrorException(err)
    }
  }

  async update(data: ProductEntity) {
    try {
      const p = await this.repo.findOne(data.id)
      if (!p) {
        throw new NotFoundException()
      }

      p.name = data.name
      p.select_mode = data.select_mode
      p.unit_price = data.unit_price
      p.desc = data.desc

      await this.repo.save(p)
    } catch (err) {
      console.error(err)
      throw new InternalServerErrorException(err)
    }
  }

  async remove(id: number) {
    try {
      const p = await this.repo.findOne(id)
      if (!p) {
        throw new NotFoundException()
      }

      await this.repo.delete(p)
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err
      }

      console.error(err)
      throw new InternalServerErrorException(err)
    }
  }
}
