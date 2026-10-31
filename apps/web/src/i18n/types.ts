export type Locale = 'vi' | 'en';

export interface TranslationDictionary {
  common: {
    systemName: string;
    portalName: string;
    save: string;
    cancel: string;
    delete: string;
    back: string;
    continue: string;
    close: string;
    loading: string;
    success: string;
    error: string;
    warning: string;
    info: string;
    search: string;
    all: string;
    copy: string;
    copied: string;
    today: string;
    yesterday: string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    connected: string;
    connectNow: string;
    unassigned: string;
  };
  nav: {
    socialComm: string;
    trainingMgmt: string;
    liveInbox: string;
    onboarding: string;
    dataImport: string;
    admissionsMgmt: string;
    applicantProfiles: string;
    reportsStats: string;
    systemSettings: string;
    userRole: string;
    crmSystem: string;
    quickTabInbox: string;
    quickTabOnboarding: string;
    quickTabImport: string;
    apiConfig: string;
    apiConfigTitle: string;
    apiConfigSave: string;
    liveChatBreadcrumb: string;
    onboardingBreadcrumb: string;
    importBreadcrumb: string;
  };
  onboarding: {
    badge: string;
    welcomeTitle: string;
    welcomeDesc: string;
    skipToInbox: string;
    steps: {
      step1: string;
      step2: string;
      step3: string;
      stepTag: string;
    };
    step1: {
      title: string;
      desc: string;
      companyName: string;
      companyPlaceholder: string;
      companyHint: string;
      industry: string;
      continueBtn: string;
      errors: {
        nameRequired: string;
      };
      industries: {
        education: string;
        ecommerce: string;
        services: string;
        tech: string;
        other: string;
      };
      scales: {
        small: string;
        medium: string;
        large: string;
        enterprise: string;
      };
    };
    step2: {
      title: string;
      desc: string;
      popularBadge: string;
      highResponseBadge: string;
      addAnotherPage: string;
      fanpagesFound: string;
      fanpagesHint: string;
      activatedPages: string;
      noPagesYet: string;
      followers: string;
      backBtn: string;
      continueBtn: string;
      channels: {
        facebookDesc: string;
        zaloDesc: string;
        tiktokDesc: string;
        instagramDesc: string;
      };
    };
    step3: {
      title: string;
      desc: string;
      emailPlaceholder: string;
      agentRole: string;
      adminRole: string;
      agentDesc: string;
      adminDesc: string;
      addBtn: string;
      invitedListTitle: string;
      colEmail: string;
      colRole: string;
      colPermissions: string;
      colAction: string;
      summaryWorkspace: string;
      summaryChannels: string;
      summaryTeam: string;
      backBtn: string;
      finishBtn: string;
      errors: {
        invalidEmail: string;
        duplicateEmail: string;
      };
    };
    oauthModal: {
      authorizingAccount: string;
      verified: string;
      permissionsTitle: string;
      termsNotice: string;
      cancelBtn: string;
      authorizingBtn: string;
      authorizeBtn: string;
    };
  };
  inbox: {
    conversationsTitle: string;
    unreadCount: string;
    contactsCount: string;
    searchPlaceholder: string;
    filterAll: string;
    filterUnread: string;
    filterAssignedToMe: string;
    filterUnassigned: string;
    emptyList: string;
    chatHeader: {
      messagingVia: string;
      meta24hValid: string;
      meta24hExpired: string;
      unassigned: string;
      resolveBtn: string;
      reopenBtn: string;
    };
    quickRepliesLabel: string;
    chatInput?: {
      placeholder: string;
      sendBtn: string;
      warning24hPlaceholder: string;
      attachFile: string;
      attachImage: string;
      voiceMessage: string;
      insertEmoji: string;
      attachSimulated: string;
      voiceRecordingNotice: string;
      voiceSentSuccess: string;
    };
    input: {
      shortcutHint: string;
      placeholder: string;
      sendBtn: string;
      tooltipPhoto: string;
      tooltipFile: string;
      tooltipMic: string;
      tooltipEmoji: string;
    };
    profile: {
      callNow: string;
      sendEmail: string;
      leadFunnelTitle: string;
      contactInfoTitle: string;
      phoneLabel: string;
      emailLabel: string;
      connectedChannelLabel: string;
      tagsTitle: string;
      addTagBtn: string;
      saveTagBtn: string;
      cancelTagBtn: string;
      tagPlaceholder: string;
      interestedCoursesTitle: string;
      noCourses: string;
      internalNotesTitle: string;
      notePlaceholder: string;
      saveNoteBtn: string;
      leadStatuses: {
        new: string;
        potential: string;
        converted: string;
        unqualified: string;
      };
    };
  };
}
