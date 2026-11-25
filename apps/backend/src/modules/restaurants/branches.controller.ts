import { Body, Controller, Get, Post, UsePipes } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createBranchSchema,
  type CreateBranchDto,
  type SessionUser,
} from '@nodedr-restaurant/types';
import { Auth } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';

// Roles that run the whole restaurant see every branch of it; everyone else
// sees only the branches they were assigned to (UserBranch).
const ALL_BRANCH_ROLES = ['OWNER', 'ADMINISTRATOR'];

@ApiTags('branches')
@Controller('v1/branches')
export class BranchesController {
  constructor(private readonly prisma: PrismaService) {}

  @Auth()
  @Get()
  listBranches(@CurrentUser() user: SessionUser) {
    const sees = ALL_BRANCH_ROLES.includes(user.roleName)
      ? {}
      : { users: { some: { userId: user.id } } };
    return this.prisma.branch.findMany({
      where: { restaurantId: user.restaurantId, isActive: true, ...sees },
      orderBy: { name: 'asc' },
    });
  }

  @Auth('settings.manage')
  @Post()
  @UsePipes(new ZodValidationPipe(createBranchSchema))
  async createBranch(
    @CurrentUser() user: SessionUser,
    @Body() body: CreateBranchDto,
  ) {
    const branch = await this.prisma.branch.create({
      data: {
        restaurantId: user.restaurantId,
        name: body.name,
        address: body.address || null,
        phone: body.phone || null,
        gstNumber: body.gstNumber || null,
        users: {
          create: {
            userId: user.id,
          },
        },
      },
    });
    return branch;
  }
}
