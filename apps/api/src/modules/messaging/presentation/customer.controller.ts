import {
    Controller,
    Get,
    Patch,
    Delete,
    Param,
    Body,
    Headers,
    Query,
    Optional,
} from '@nestjs/common';
import { CustomerService, UpdateCustomerDto } from '../application/customer.service.js';
import { RealtimeService } from '../../realtime/realtime.service.js';
import { ContactMergeService } from '../application/contact-merge.service.js';

/**
 * Controller managing workspace customers, recruitment leads, and pipeline stages.
 * Presentation layer delegating business workflows to CustomerService.
 */
@Controller('customers')
export class CustomerController {
    private readonly customerService: CustomerService;

    constructor(
        customerServiceOrPrisma: CustomerService,
        @Optional() realtime?: RealtimeService,
        @Optional() mergeService?: ContactMergeService,
    ) {
        if (customerServiceOrPrisma && typeof (customerServiceOrPrisma as any).getCustomers === 'function') {
            this.customerService = customerServiceOrPrisma;
        } else {
            this.customerService = new CustomerService(customerServiceOrPrisma as any, realtime, mergeService);
        }
    }

    /**
     * Retrieve list of customers within a workspace, supporting pagination, unaccent search, and phone lookup
     */
    @Get()
    async getCustomers(
        @Headers('x-workspace-id') headerWsId?: string,
        @Query('workspaceId') queryWsId?: string,
        @Query('search') search?: string,
        @Query('page') pageStr?: string,
        @Query('limit') limitStr?: string,
        @Query('leadStatus') leadStatus?: string,
        @Query('leadStage') leadStage?: string,
    ) {
        return this.customerService.getCustomers({
            rawWsId: queryWsId || headerWsId,
            search,
            pageStr,
            limitStr,
            leadStatus,
            leadStage,
        });
    }

    /**
     * Retrieve single customer details by ID (including conversations, notes, identities)
     */
    @Get(':id')
    async getCustomerById(
        @Param('id') id: string,
        @Headers('x-workspace-id') _headerWsId?: string,
        @Query('workspaceId') _queryWsId?: string,
    ) {
        return this.customerService.getCustomerById(id);
    }

    /**
     * Đồng bộ phân công nhân sự (staff / workspace_member) cho cuộc hội thoại
     * Đảm bảo toàn vẹn tham chiếu với bảng workspace_members
     */
    @Patch('conversations/:conversationId/assign')
    async assignConversation(
        @Param('conversationId') conversationId: string,
        @Body() body: { staffId?: string | null; staffName?: string | null },
        @Headers('x-workspace-id') headerWsId?: string,
    ) {
        return this.customerService.assignConversation(conversationId, body.staffId, body.staffName, headerWsId);
    }

    /**
     * Update customer profile, recruitment pipeline stage, and lead qualification status.
     * Automatically broadcasts real-time pipeline changes to connected staff.
     */
    @Patch(':id')
    async updateCustomer(
        @Param('id') id: string,
        @Body() body: UpdateCustomerDto,
        @Headers('x-workspace-id') headerWsId?: string,
    ) {
        return this.customerService.updateCustomer(id, body, headerWsId);
    }

    /**
     * Remove a tag from customer and associated conversations via CRM
     */
    @Delete(':id/tags/:tag')
    async removeCustomerTag(
        @Param('id') id: string,
        @Param('tag') tagToRemove: string,
    ) {
        return this.customerService.removeCustomerTag(id, tagToRemove);
    }
}
