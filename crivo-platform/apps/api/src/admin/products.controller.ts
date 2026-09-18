import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { PlatformAdmin } from '@crivo/types';
import { ProductsService } from './products.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentAdmin } from './platform-admin.decorator';
import { SetProductStatusDto, UpsertProductDto } from './commerce.dto';

/** Catálogo de produtos (control plane). Exclusivo de super admins. */
@Controller('admin/products')
@UseGuards(SuperAdminGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list() {
    return this.products.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.get(id);
  }

  @Post()
  create(@CurrentAdmin() admin: PlatformAdmin, @Body() dto: UpsertProductDto) {
    return this.products.create(dto, { id: admin.id, email: admin.email });
  }

  @Put(':id')
  update(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertProductDto,
  ) {
    return this.products.update(id, dto, { id: admin.id, email: admin.email });
  }

  /** Inativar (sai da venda, contratos existentes seguem) ou reativar. */
  @Patch(':id/status')
  setStatus(
    @CurrentAdmin() admin: PlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetProductStatusDto,
  ) {
    return this.products.setStatus(id, dto.status, { id: admin.id, email: admin.email });
  }

  @Delete(':id')
  remove(@CurrentAdmin() admin: PlatformAdmin, @Param('id', ParseUUIDPipe) id: string) {
    return this.products.remove(id, { id: admin.id, email: admin.email });
  }
}
