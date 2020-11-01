import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { OrderEntity } from "./order.entity"

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity])],
  providers: [],
  exports: []
})
export class MainModule {}
