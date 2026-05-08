import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  CacheInterceptor,
  CacheTTL,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CardsService } from './cards.service'
import { SearchCardsDto } from './dto/search-cards.dto'
import { PriceHistoryDto } from './dto/price-history.dto'
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

@ApiTags('cards')
@Controller({ path: 'cards', version: '1' })
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search and filter cards' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'set', required: false })
  @ApiQuery({ name: 'rarity', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'language', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sort', required: false, description: 'price_asc|price_desc|change_desc|name_asc' })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30_000)
  async search(@Query() dto: SearchCardsDto) {
    return this.cardsService.search(dto)
  }

  @Get('trending')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60_000)
  async getTrending(@Query('limit') limit = 20) {
    return this.cardsService.getTrending(limit)
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60_000)
  async getById(@Param('id') id: string, @CurrentUser() user?: { id: string }) {
    return this.cardsService.getById(id, user?.id)
  }

  @Get(':id/price-history')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(120_000)
  async getPriceHistory(@Param('id') id: string, @Query() dto: PriceHistoryDto) {
    return this.cardsService.getPriceHistory(id, dto)
  }

  @Get(':id/variants')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300_000)
  async getVariants(@Param('id') id: string) {
    return this.cardsService.getVariants(id)
  }

  @Get(':id/graded-prices')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(120_000)
  async getGradedPrices(@Param('id') id: string) {
    return this.cardsService.getGradedPrices(id)
  }

  @Get(':id/sales')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60_000)
  async getRecentSales(
    @Param('id') id: string,
    @Query('limit') limit = 20,
    @Query('source') source?: string,
  ) {
    return this.cardsService.getRecentSales(id, { limit, source })
  }

  @Get(':id/similar')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300_000)
  async getSimilar(@Param('id') id: string, @Query('setId') setId?: string) {
    return this.cardsService.getSimilar(id, setId)
  }

  @Post(':id/view')
  @Throttle({ short: { ttl: 60_000, limit: 1 } })
  async trackView(@Param('id') id: string) {
    return this.cardsService.trackView(id)
  }
}
