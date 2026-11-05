import { BaseApiClient } from './core.js';
import { createChannelApi } from './channels.js';
import { createCustomerApi } from './customers.js';
import { createWorkspaceApi } from './workspaces.js';
import { createContactApi } from './contacts.js';

export * from './types.js';
export * from './core.js';
export * from './channels.js';
export * from './customers.js';
export * from './workspaces.js';
export * from './contacts.js';

export class ApiClient extends BaseApiClient {
  private channels = createChannelApi(this);
  private customers = createCustomerApi(this);
  private workspaces = createWorkspaceApi(this);
  private contacts = createContactApi(this);

  // Sub-modules
  readonly channelApi = this.channels;
  readonly customerApi = this.customers;
  readonly workspaceApi = this.workspaces;
  readonly contactApi = this.contacts;

  // Channel & OAuth APIs
  getAuthorizeUrl = this.channels.getAuthorizeUrl;
  exchangeOAuthToken = this.channels.exchangeOAuthToken;
  activateChannels = this.channels.activateChannels;
  getChannels = this.channels.getChannels;
  toggleChannel = this.channels.toggleChannel;
  disconnectChannel = this.channels.disconnectChannel;
  syncChannel = this.channels.syncChannel;
  sendMessage = this.channels.sendMessage;
  markFacebookConversationSeen = this.channels.markFacebookConversationSeen;
  initZaloPersonalQr = this.channels.initZaloPersonalQr;
  getZaloPersonalQrStatus = this.channels.getZaloPersonalQrStatus;
  confirmZaloPersonalQr = this.channels.confirmZaloPersonalQr;
  getZaloSafetyConfig = this.channels.getZaloSafetyConfig;
  updateZaloSafetyConfig = this.channels.updateZaloSafetyConfig;

  // Customer & Message APIs
  getMessages = this.customers.getMessages;
  getCustomers = this.customers.getCustomers;
  updateCustomer = this.customers.updateCustomer;
  assignConversation = this.customers.assignConversation;
  deleteCustomerTag = this.customers.deleteCustomerTag;

  // Workspace, Hotline & Notification APIs
  getMyWorkspaces = this.workspaces.getMyWorkspaces;
  createWorkspace = this.workspaces.createWorkspace;
  updateWorkspace = this.workspaces.updateWorkspace;
  deleteWorkspace = this.workspaces.deleteWorkspace;
  getWorkspaceHotlines = this.workspaces.getWorkspaceHotlines;
  createWorkspaceHotline = this.workspaces.createWorkspaceHotline;
  updateWorkspaceHotline = this.workspaces.updateWorkspaceHotline;
  deleteWorkspaceHotline = this.workspaces.deleteWorkspaceHotline;
  getNotifications = this.workspaces.getNotifications;
  markNotificationRead = this.workspaces.markNotificationRead;
  markAllNotificationsRead = this.workspaces.markAllNotificationsRead;
  deleteNotification = this.workspaces.deleteNotification;

  // Contact & Merge/Unmerge APIs
  getContacts = this.contacts.getContacts;
  checkDuplicatePhone = this.contacts.checkDuplicatePhone;
  mergeContacts = this.contacts.mergeContacts;
  unmergeContact = this.contacts.unmergeContact;
  getContactMergeHistory = this.contacts.getContactMergeHistory;
}

export const apiClient = new ApiClient();
export default apiClient;

