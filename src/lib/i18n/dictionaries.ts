import type { Locale } from './config';

export interface Dictionary {
  appName: string;
  tagline: string;
  nav: {
    dashboard: string;
    live: string;
    drivers: string;
    onboarding: string;
    riders: string;
    rides: string;
    money: string;
    analytics: string;
    ratings: string;
    fares: string;
    support: string;
    requests: string;
    reports: string;
    operations: string;
    staff: string;
    logout: string;
  };
  live: {
    title: string;
    activeRides: string;
    noActiveRides: string;
    sosAlerts: string;
    noSos: string;
    rider: string;
    driver: string;
    status: string;
    fare: string;
    womenOnly: string;
    elapsed: string;
    cancelRide: string;
    cancelConfirm: string;
    map: string;
    resolve: string;
    note: string;
    autoRefresh: string;
    actionFailed: string;
  };
  login: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    submit: string;
  };
  dashboard: {
    title: string;
    totalDrivers: string;
    onlineDrivers: string;
    totalRiders: string;
    ridesToday: string;
    completedRides: string;
    activeRides: string;
    recentRides: string;
  };
  drivers: {
    title: string;
    name: string;
    phone: string;
    status: string;
    approved: string;
    rides: string;
    vehicle: string;
    founder: string;
    approve: string;
    revoke: string;
    addDriver: string;
    email: string;
    password: string;
    city: string;
    vehicleTypeLabel: string;
    regNo: string;
    model: string;
    color: string;
    create: string;
    created: string;
  };
  account: {
    title: string;
    profile: string;
    name: string;
    email: string;
    role: string;
    regions: string;
    noRegions: string;
    save: string;
    saved: string;
    changePassword: string;
    newPassword: string;
    passwordChanged: string;
  };
  riders: {
    title: string;
    name: string;
    phone: string;
    joined: string;
    rides: string;
  };
  rides: {
    title: string;
    rider: string;
    driver: string;
    status: string;
    fare: string;
    pickup: string;
    drop: string;
    when: string;
  };
  fares: {
    title: string;
    vehicleType: string;
    baseFare: string;
    perKm: string;
    perMin: string;
    minFare: string;
    save: string;
    saved: string;
    region: string;
    global: string;
    country: string;
    state: string;
    city: string;
    optional: string;
    addScope: string;
    create: string;
    created: string;
    remove: string;
    removeConfirm: string;
    noScopes: string;
  };
  support: {
    title: string;
    user: string;
    subject: string;
    message: string;
    status: string;
    when: string;
    empty: string;
    priority: string;
    resolve: string;
    reopen: string;
    priorityLow: string;
    priorityNormal: string;
    priorityHigh: string;
    priorityUrgent: string;
    openOnly: string;
    all: string;
  };
  profile: {
    overview: string;
    documents: string;
    ridesTab: string;
    ratings: string;
    earnings: string;
    subscriptions: string;
    wallet: string;
    manager: string;
    vehicle: string;
    gender: string;
    joined: string;
    totalRides: string;
    rating: string;
    balance: string;
    earningsTotal: string;
    blocked: string;
    blockUser: string;
    unblockUser: string;
    blockReason: string;
    blockConfirm: string;
    unblockConfirm: string;
    approveDoc: string;
    rejectDoc: string;
    reviewNote: string;
    paid: string;
    unpaid: string;
    noDocuments: string;
    noRides: string;
    noRatings: string;
    noSubscriptions: string;
    noTransactions: string;
  };
  onboarding: {
    title: string;
    subtitle: string;
    allClear: string;
    review: string;
  };
  staff: {
    title: string;
    addStaff: string;
    name: string;
    email: string;
    password: string;
    role: string;
    roleSuperAdmin: string;
    roleAdmin: string;
    roleSupport: string;
    create: string;
    created: string;
    you: string;
    regions: string;
    allRegions: string;
    noRegions: string;
    addRegion: string;
    removeRegion: string;
    country: string;
    state: string;
    city: string;
    regionHint: string;
  };
  money: {
    title: string;
    subtitle: string;
    collectedToday: string;
    paid: string;
    unpaid: string;
    refunded: string;
    walletFloat: string;
    collectionRate: string;
    last14Days: string;
    driver: string;
    city: string;
    amount: string;
    method: string;
    wallet: string;
    cash: string;
    all: string;
    status: string;
  };
  analytics: {
    title: string;
    daily: string;
    monthly: string;
    quarterly: string;
    yearly: string;
    completedRides: string;
    driverEarnings: string;
    platformRevenue: string;
    ridesOverTime: string;
    revenueOverTime: string;
    cityPerformance: string;
    city: string;
    drivers: string;
    online: string;
    rides: string;
    avgRating: string;
    leaderboards: string;
    topByRides: string;
    topByRating: string;
    needsAttention: string;
    noData: string;
  };
  ratings: {
    title: string;
    subtitle: string;
    all: string;
    lowOnly: string;
    from: string;
    to: string;
    comment: string;
    when: string;
    noRatings: string;
  };
  search: {
    title: string;
    placeholder: string;
    drivers: string;
    riders: string;
    noResults: string;
    prompt: string;
  };
  common: {
    yes: string;
    no: string;
    none: string;
    loading: string;
    search: string;
    back: string;
    success: string;
    failed: string;
    save: string;
    cancel: string;
  };
}

const en: Dictionary = {
  appName: 'Bandi Admin',
  tagline: 'Every rupee goes to drivers',
  nav: {
    dashboard: 'Dashboard',
    live: 'Live',
    drivers: 'Drivers',
    onboarding: 'Onboarding',
    riders: 'Riders',
    rides: 'Rides',
    money: 'Revenue',
    analytics: 'Analytics',
    ratings: 'Ratings',
    fares: 'Fares',
    support: 'Support',
    requests: 'Website requests',
    reports: 'Reports',
    operations: 'Operations queue',
    staff: 'Staff',
    logout: 'Log out',
  },
  live: {
    title: 'Live operations',
    activeRides: 'Active rides',
    noActiveRides: 'No active rides right now',
    sosAlerts: 'SOS alerts',
    noSos: 'No active SOS alerts',
    rider: 'Rider',
    driver: 'Driver',
    status: 'Status',
    fare: 'Fare',
    womenOnly: 'Women only',
    elapsed: 'Elapsed',
    cancelRide: 'Cancel',
    cancelConfirm: 'Cancel this ride?',
    map: 'Map',
    resolve: 'Resolve',
    note: 'Note',
    autoRefresh: 'Auto-refreshing every 5s',
    actionFailed: 'Action failed — please try again',
  },
  login: {
    title: 'Admin sign in',
    subtitle: 'Bandi operations console',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
  },
  dashboard: {
    title: 'Dashboard',
    totalDrivers: 'Total drivers',
    onlineDrivers: 'Online now',
    totalRiders: 'Total riders',
    ridesToday: 'Rides today',
    completedRides: 'Completed rides',
    activeRides: 'Active rides',
    recentRides: 'Recent rides',
  },
  drivers: {
    title: 'Drivers',
    name: 'Name',
    phone: 'Phone',
    status: 'Status',
    approved: 'Approved',
    rides: 'Rides',
    vehicle: 'Vehicle',
    founder: 'Founder',
    approve: 'Approve',
    revoke: 'Revoke',
    addDriver: 'Add driver',
    email: 'Email',
    password: 'Temporary password',
    city: 'City',
    vehicleTypeLabel: 'Vehicle type',
    regNo: 'Vehicle reg. no.',
    model: 'Model',
    color: 'Color',
    create: 'Create driver',
    created: 'Driver created',
  },
  account: {
    title: 'My account',
    profile: 'Profile',
    name: 'Full name',
    email: 'Email',
    role: 'Role',
    regions: 'Regions',
    noRegions: 'No regions assigned',
    save: 'Save',
    saved: 'Saved',
    changePassword: 'Change password',
    newPassword: 'New password',
    passwordChanged: 'Password updated',
  },
  riders: {
    title: 'Riders',
    name: 'Name',
    phone: 'Phone',
    joined: 'Joined',
    rides: 'Rides',
  },
  rides: {
    title: 'Rides',
    rider: 'Rider',
    driver: 'Driver',
    status: 'Status',
    fare: 'Fare',
    pickup: 'Pickup',
    drop: 'Drop',
    when: 'When',
  },
  fares: {
    title: 'Fare configuration',
    vehicleType: 'Vehicle type',
    baseFare: 'Base fare (₹)',
    perKm: 'Per km (₹)',
    perMin: 'Per min (₹)',
    minFare: 'Minimum fare (₹)',
    save: 'Save changes',
    saved: 'Saved',
    region: 'Region',
    global: 'Global default',
    country: 'Country',
    state: 'State',
    city: 'City',
    optional: 'optional',
    addScope: 'Add fare for a region',
    create: 'Add fare',
    created: 'Fare added',
    remove: 'Remove',
    removeConfirm: 'Remove this regional fare? The next-broadest fare will apply.',
    noScopes: 'You have no fare regions assigned yet. Ask a super admin to grant one.',
  },
  support: {
    title: 'Support tickets',
    user: 'User',
    subject: 'Subject',
    message: 'Message',
    status: 'Status',
    when: 'When',
    empty: 'No support tickets',
    priority: 'Priority',
    resolve: 'Resolve',
    reopen: 'Reopen',
    priorityLow: 'Low',
    priorityNormal: 'Normal',
    priorityHigh: 'High',
    priorityUrgent: 'Urgent',
    openOnly: 'Open',
    all: 'All',
  },
  profile: {
    overview: 'Overview',
    documents: 'Documents',
    ridesTab: 'Rides',
    ratings: 'Ratings',
    earnings: 'Earnings',
    subscriptions: 'Subscriptions',
    wallet: 'Wallet',
    manager: 'Manager',
    vehicle: 'Vehicle',
    gender: 'Gender',
    joined: 'Joined',
    totalRides: 'Total rides',
    rating: 'Rating',
    balance: 'Wallet balance',
    earningsTotal: 'Lifetime earnings',
    blocked: 'Blocked',
    blockUser: 'Block',
    unblockUser: 'Unblock',
    blockReason: 'Reason (optional)',
    blockConfirm: 'Block this user? They will not be able to use the app.',
    unblockConfirm: 'Unblock this user?',
    approveDoc: 'Approve',
    rejectDoc: 'Reject',
    reviewNote: 'Review note (optional)',
    paid: 'Paid',
    unpaid: 'Unpaid',
    noDocuments: 'No documents uploaded',
    noRides: 'No rides yet',
    noRatings: 'No ratings yet',
    noSubscriptions: 'No subscriptions',
    noTransactions: 'No transactions',
  },
  onboarding: {
    title: 'Driver onboarding',
    subtitle: 'Drivers awaiting approval',
    allClear: 'No drivers pending approval',
    review: 'Review',
  },
  staff: {
    title: 'Staff & roles',
    addStaff: 'Add staff member',
    name: 'Full name',
    email: 'Email',
    password: 'Temporary password',
    role: 'Role',
    roleSuperAdmin: 'Super Admin',
    roleAdmin: 'Admin',
    roleSupport: 'Support',
    create: 'Create staff',
    created: 'Staff member created',
    you: 'You',
    regions: 'Regions',
    allRegions: 'Full access (all regions)',
    noRegions: 'No regions assigned',
    addRegion: 'Add region',
    removeRegion: 'Remove region',
    country: 'Country',
    state: 'State',
    city: 'City',
    regionHint: 'Admins can edit fares only within their assigned regions.',
  },
  money: {
    title: 'Revenue & subscriptions',
    subtitle: '₹69/day driver subscriptions — every rupee of rides goes to drivers',
    collectedToday: 'Collected today',
    paid: 'Paid',
    unpaid: 'Unpaid',
    refunded: 'Refunded today',
    walletFloat: 'Wallet float',
    collectionRate: 'Collection rate',
    last14Days: 'Last 14 days',
    driver: 'Driver',
    city: 'City',
    amount: 'Amount',
    method: 'Method',
    wallet: 'Wallet',
    cash: 'Cash / UPI',
    all: 'All',
    status: 'Status',
  },
  analytics: {
    title: 'Analytics',
    daily: 'Daily',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
    completedRides: 'Completed rides',
    driverEarnings: 'Driver earnings',
    platformRevenue: 'Platform revenue',
    ridesOverTime: 'Rides over time',
    revenueOverTime: 'Revenue over time',
    cityPerformance: 'Performance by city',
    city: 'City',
    drivers: 'Drivers',
    online: 'Online',
    rides: 'Rides',
    avgRating: 'Avg rating',
    leaderboards: 'Leaderboards',
    topByRides: 'Most rides',
    topByRating: 'Best rated',
    needsAttention: 'Needs attention',
    noData: 'No data for this period',
  },
  ratings: {
    title: 'Ratings & reviews',
    subtitle: 'Rider and driver feedback',
    all: 'All ratings',
    lowOnly: 'Low ratings (≤ 2★)',
    from: 'From',
    to: 'To',
    comment: 'Comment',
    when: 'When',
    noRatings: 'No ratings found',
  },
  search: {
    title: 'Search',
    placeholder: 'Search drivers & riders…',
    drivers: 'Drivers',
    riders: 'Riders',
    noResults: 'No matches found',
    prompt: 'Type a name or phone number to search',
  },
  common: {
    yes: 'Yes',
    no: 'No',
    none: 'None',
    loading: 'Loading…',
    search: 'Search by name or phone',
    back: 'Back',
    success: 'Done',
    failed: 'Action failed — please try again',
    save: 'Save',
    cancel: 'Cancel',
  },
};

const te: Dictionary = {
  appName: 'బండి అడ్మిన్',
  tagline: 'ప్రతి రూపాయి డ్రైవర్‌లకే',
  nav: {
    dashboard: 'డాష్‌బోర్డ్',
    live: 'లైవ్',
    drivers: 'డ్రైవర్లు',
    onboarding: 'ఆన్‌బోర్డింగ్',
    riders: 'రైడర్లు',
    rides: 'రైడ్‌లు',
    money: 'ఆదాయం',
    analytics: 'విశ్లేషణలు',
    ratings: 'రేటింగ్‌లు',
    fares: 'ఛార్జీలు',
    support: 'సహాయం',
    requests: 'వెబ్‌సైట్ రిక్వెస్ట్‌లు',
    reports: 'ఫిర్యాదులు',
    operations: 'ఆపరేషన్స్ క్యూ',
    staff: 'సిబ్బంది',
    logout: 'లాగ్ అవుట్',
  },
  live: {
    title: 'లైవ్ ఆపరేషన్స్',
    activeRides: 'యాక్టివ్ రైడ్‌లు',
    noActiveRides: 'ప్రస్తుతం యాక్టివ్ రైడ్‌లు లేవు',
    sosAlerts: 'SOS అలర్ట్‌లు',
    noSos: 'యాక్టివ్ SOS అలర్ట్‌లు లేవు',
    rider: 'రైడర్',
    driver: 'డ్రైవర్',
    status: 'స్థితి',
    fare: 'ఛార్జీ',
    womenOnly: 'మహిళలకు మాత్రమే',
    elapsed: 'గడిచిన సమయం',
    cancelRide: 'రద్దు చేయి',
    cancelConfirm: 'ఈ రైడ్‌ను రద్దు చేయాలా?',
    map: 'మ్యాప్',
    resolve: 'పరిష్కరించు',
    note: 'గమనిక',
    autoRefresh: 'ప్రతి 5సె.కు రిఫ్రెష్ అవుతోంది',
    actionFailed: 'చర్య విఫలమైంది — దయచేసి మళ్లీ ప్రయత్నించండి',
  },
  login: {
    title: 'అడ్మిన్ సైన్ ఇన్',
    subtitle: 'బండి ఆపరేషన్స్ కన్సోల్',
    email: 'ఇమెయిల్',
    password: 'పాస్‌వర్డ్',
    submit: 'సైన్ ఇన్',
  },
  dashboard: {
    title: 'డాష్‌బోర్డ్',
    totalDrivers: 'మొత్తం డ్రైవర్లు',
    onlineDrivers: 'ఇప్పుడు ఆన్‌లైన్',
    totalRiders: 'మొత్తం రైడర్లు',
    ridesToday: 'నేటి రైడ్‌లు',
    completedRides: 'పూర్తయిన రైడ్‌లు',
    activeRides: 'యాక్టివ్ రైడ్‌లు',
    recentRides: 'ఇటీవలి రైడ్‌లు',
  },
  drivers: {
    title: 'డ్రైవర్లు',
    name: 'పేరు',
    phone: 'ఫోన్',
    status: 'స్థితి',
    approved: 'ఆమోదించబడింది',
    rides: 'రైడ్‌లు',
    vehicle: 'వాహనం',
    founder: 'వ్యవస్థాపకుడు',
    approve: 'ఆమోదించు',
    revoke: 'రద్దు చేయి',
    addDriver: 'డ్రైవర్‌ను జోడించు',
    email: 'ఇమెయిల్',
    password: 'తాత్కాలిక పాస్‌వర్డ్',
    city: 'నగరం',
    vehicleTypeLabel: 'వాహన రకం',
    regNo: 'వాహన రిజి. నం.',
    model: 'మోడల్',
    color: 'రంగు',
    create: 'డ్రైవర్‌ను సృష్టించు',
    created: 'డ్రైవర్ సృష్టించబడింది',
  },
  account: {
    title: 'నా ఖాతా',
    profile: 'ప్రొఫైల్',
    name: 'పూర్తి పేరు',
    email: 'ఇమెయిల్',
    role: 'పాత్ర',
    regions: 'ప్రాంతాలు',
    noRegions: 'ఏ ప్రాంతాలూ కేటాయించబడలేదు',
    save: 'సేవ్ చేయి',
    saved: 'సేవ్ అయింది',
    changePassword: 'పాస్‌వర్డ్ మార్చు',
    newPassword: 'కొత్త పాస్‌వర్డ్',
    passwordChanged: 'పాస్‌వర్డ్ నవీకరించబడింది',
  },
  riders: {
    title: 'రైడర్లు',
    name: 'పేరు',
    phone: 'ఫోన్',
    joined: 'చేరిన తేదీ',
    rides: 'రైడ్‌లు',
  },
  rides: {
    title: 'రైడ్‌లు',
    rider: 'రైడర్',
    driver: 'డ్రైవర్',
    status: 'స్థితి',
    fare: 'ఛార్జీ',
    pickup: 'పికప్',
    drop: 'డ్రాప్',
    when: 'సమయం',
  },
  fares: {
    title: 'ఛార్జీ కాన్ఫిగరేషన్',
    vehicleType: 'వాహన రకం',
    baseFare: 'బేస్ ఛార్జీ (₹)',
    perKm: 'కి.మీ.కి (₹)',
    perMin: 'నిమిషానికి (₹)',
    minFare: 'కనిష్ట ఛార్జీ (₹)',
    save: 'మార్పులను సేవ్ చేయి',
    saved: 'సేవ్ అయింది',
    region: 'ప్రాంతం',
    global: 'గ్లోబల్ డిఫాల్ట్',
    country: 'దేశం',
    state: 'రాష్ట్రం',
    city: 'నగరం',
    optional: 'ఐచ్ఛికం',
    addScope: 'ఒక ప్రాంతానికి ఛార్జీ జోడించు',
    create: 'ఛార్జీ జోడించు',
    created: 'ఛార్జీ జోడించబడింది',
    remove: 'తొలగించు',
    removeConfirm: 'ఈ ప్రాంతీయ ఛార్జీని తొలగించాలా? తదుపరి విస్తృత ఛార్జీ వర్తిస్తుంది.',
    noScopes: 'మీకు ఇంకా ఏ ఛార్జీ ప్రాంతాలూ కేటాయించబడలేదు. సూపర్ అడ్మిన్‌ను అడగండి.',
  },
  support: {
    title: 'సహాయ టికెట్‌లు',
    user: 'వినియోగదారు',
    subject: 'విషయం',
    message: 'సందేశం',
    status: 'స్థితి',
    when: 'సమయం',
    empty: 'సహాయ టికెట్‌లు లేవు',
    priority: 'ప్రాధాన్యత',
    resolve: 'పరిష్కరించు',
    reopen: 'మళ్లీ తెరువు',
    priorityLow: 'తక్కువ',
    priorityNormal: 'సాధారణ',
    priorityHigh: 'అధిక',
    priorityUrgent: 'అత్యవసరం',
    openOnly: 'తెరిచినవి',
    all: 'అన్నీ',
  },
  profile: {
    overview: 'అవలోకనం',
    documents: 'పత్రాలు',
    ridesTab: 'రైడ్‌లు',
    ratings: 'రేటింగ్‌లు',
    earnings: 'ఆదాయం',
    subscriptions: 'సబ్‌స్క్రిప్షన్‌లు',
    wallet: 'వాలెట్',
    manager: 'మేనేజర్',
    vehicle: 'వాహనం',
    gender: 'లింగం',
    joined: 'చేరిన తేదీ',
    totalRides: 'మొత్తం రైడ్‌లు',
    rating: 'రేటింగ్',
    balance: 'వాలెట్ నిల్వ',
    earningsTotal: 'మొత్తం ఆదాయం',
    blocked: 'బ్లాక్ చేయబడింది',
    blockUser: 'బ్లాక్ చేయి',
    unblockUser: 'అన్‌బ్లాక్ చేయి',
    blockReason: 'కారణం (ఐచ్ఛికం)',
    blockConfirm: 'ఈ వినియోగదారుని బ్లాక్ చేయాలా? వారు యాప్‌ను ఉపయోగించలేరు.',
    unblockConfirm: 'ఈ వినియోగదారుని అన్‌బ్లాక్ చేయాలా?',
    approveDoc: 'ఆమోదించు',
    rejectDoc: 'తిరస్కరించు',
    reviewNote: 'సమీక్ష గమనిక (ఐచ్ఛికం)',
    paid: 'చెల్లించబడింది',
    unpaid: 'చెల్లించలేదు',
    noDocuments: 'పత్రాలు అప్‌లోడ్ చేయలేదు',
    noRides: 'ఇంకా రైడ్‌లు లేవు',
    noRatings: 'ఇంకా రేటింగ్‌లు లేవు',
    noSubscriptions: 'సబ్‌స్క్రిప్షన్‌లు లేవు',
    noTransactions: 'లావాదేవీలు లేవు',
  },
  onboarding: {
    title: 'డ్రైవర్ ఆన్‌బోర్డింగ్',
    subtitle: 'ఆమోదం కోసం ఎదురుచూస్తున్న డ్రైవర్లు',
    allClear: 'ఆమోదం పెండింగ్‌లో ఉన్న డ్రైవర్లు లేరు',
    review: 'సమీక్షించు',
  },
  staff: {
    title: 'సిబ్బంది & పాత్రలు',
    addStaff: 'సిబ్బందిని జోడించు',
    name: 'పూర్తి పేరు',
    email: 'ఇమెయిల్',
    password: 'తాత్కాలిక పాస్‌వర్డ్',
    role: 'పాత్ర',
    roleSuperAdmin: 'సూపర్ అడ్మిన్',
    roleAdmin: 'అడ్మిన్',
    roleSupport: 'సహాయం',
    create: 'సిబ్బందిని సృష్టించు',
    created: 'సిబ్బంది సృష్టించబడింది',
    you: 'మీరు',
    regions: 'ప్రాంతాలు',
    allRegions: 'పూర్తి యాక్సెస్ (అన్ని ప్రాంతాలు)',
    noRegions: 'ఏ ప్రాంతాలూ కేటాయించబడలేదు',
    addRegion: 'ప్రాంతం జోడించు',
    removeRegion: 'ప్రాంతం తొలగించు',
    country: 'దేశం',
    state: 'రాష్ట్రం',
    city: 'నగరం',
    regionHint: 'అడ్మిన్లు తమకు కేటాయించిన ప్రాంతాల్లో మాత్రమే ఛార్జీలను సవరించగలరు.',
  },
  money: {
    title: 'ఆదాయం & సబ్‌స్క్రిప్షన్‌లు',
    subtitle: 'రోజుకు ₹69 డ్రైవర్ సబ్‌స్క్రిప్షన్‌లు — రైడ్‌ల ప్రతి రూపాయి డ్రైవర్‌లకే',
    collectedToday: 'నేడు వసూలు',
    paid: 'చెల్లించారు',
    unpaid: 'చెల్లించలేదు',
    refunded: 'నేడు రీఫండ్',
    walletFloat: 'వాలెట్ ఫ్లోట్',
    collectionRate: 'వసూలు రేటు',
    last14Days: 'గత 14 రోజులు',
    driver: 'డ్రైవర్',
    city: 'నగరం',
    amount: 'మొత్తం',
    method: 'విధానం',
    wallet: 'వాలెట్',
    cash: 'నగదు / UPI',
    all: 'అన్నీ',
    status: 'స్థితి',
  },
  analytics: {
    title: 'విశ్లేషణలు',
    daily: 'రోజువారీ',
    monthly: 'నెలవారీ',
    quarterly: 'త్రైమాసిక',
    yearly: 'వార్షిక',
    completedRides: 'పూర్తయిన రైడ్‌లు',
    driverEarnings: 'డ్రైవర్ ఆదాయం',
    platformRevenue: 'ప్లాట్‌ఫారం ఆదాయం',
    ridesOverTime: 'కాలక్రమంలో రైడ్‌లు',
    revenueOverTime: 'కాలక్రమంలో ఆదాయం',
    cityPerformance: 'నగరం వారీగా పనితీరు',
    city: 'నగరం',
    drivers: 'డ్రైవర్లు',
    online: 'ఆన్‌లైన్',
    rides: 'రైడ్‌లు',
    avgRating: 'సగటు రేటింగ్',
    leaderboards: 'లీడర్‌బోర్డ్‌లు',
    topByRides: 'అత్యధిక రైడ్‌లు',
    topByRating: 'ఉత్తమ రేటింగ్',
    needsAttention: 'శ్రద్ధ అవసరం',
    noData: 'ఈ కాలానికి డేటా లేదు',
  },
  ratings: {
    title: 'రేటింగ్‌లు & సమీక్షలు',
    subtitle: 'రైడర్ మరియు డ్రైవర్ అభిప్రాయం',
    all: 'అన్ని రేటింగ్‌లు',
    lowOnly: 'తక్కువ రేటింగ్‌లు (≤ 2★)',
    from: 'నుండి',
    to: 'కు',
    comment: 'వ్యాఖ్య',
    when: 'ఎప్పుడు',
    noRatings: 'రేటింగ్‌లు కనుగొనబడలేదు',
  },
  search: {
    title: 'వెతుకు',
    placeholder: 'డ్రైవర్లు & రైడర్లను వెతుకు…',
    drivers: 'డ్రైవర్లు',
    riders: 'రైడర్లు',
    noResults: 'సరిపోలికలు కనుగొనబడలేదు',
    prompt: 'వెతకడానికి పేరు లేదా ఫోన్ నంబర్ టైప్ చేయండి',
  },
  common: {
    yes: 'అవును',
    no: 'కాదు',
    none: 'ఏదీ లేదు',
    loading: 'లోడ్ అవుతోంది…',
    search: 'పేరు లేదా ఫోన్ ద్వారా వెతుకు',
    back: 'వెనుకకు',
    success: 'పూర్తయింది',
    failed: 'చర్య విఫలమైంది — దయచేసి మళ్లీ ప్రయత్నించండి',
    save: 'సేవ్ చేయి',
    cancel: 'రద్దు చేయి',
  },
};

const hi: Dictionary = {
  appName: 'बांदी एडमिन',
  tagline: 'हर रुपया ड्राइवर को',
  nav: {
    dashboard: 'डैशबोर्ड',
    live: 'लाइव',
    drivers: 'ड्राइवर',
    onboarding: 'ऑनबोर्डिंग',
    riders: 'राइडर',
    rides: 'सवारियां',
    money: 'राजस्व',
    analytics: 'विश्लेषण',
    ratings: 'रेटिंग',
    fares: 'किराया',
    support: 'सहायता',
    requests: 'वेबसाइट अनुरोध',
    reports: 'रिपोर्ट',
    operations: 'ऑपरेशंस कतार',
    staff: 'स्टाफ',
    logout: 'लॉग आउट',
  },
  live: {
    title: 'लाइव ऑपरेशंस',
    activeRides: 'सक्रिय सवारियां',
    noActiveRides: 'अभी कोई सक्रिय सवारी नहीं',
    sosAlerts: 'SOS अलर्ट',
    noSos: 'कोई सक्रिय SOS अलर्ट नहीं',
    rider: 'राइडर',
    driver: 'ड्राइवर',
    status: 'स्थिति',
    fare: 'किराया',
    womenOnly: 'केवल महिलाएं',
    elapsed: 'बीता समय',
    cancelRide: 'रद्द करें',
    cancelConfirm: 'इस सवारी को रद्द करें?',
    map: 'मानचित्र',
    resolve: 'हल करें',
    note: 'नोट',
    autoRefresh: 'हर 5 सेकंड में रिफ़्रेश',
    actionFailed: 'कार्रवाई विफल — कृपया पुनः प्रयास करें',
  },
  login: {
    title: 'एडमिन साइन इन',
    subtitle: 'बांदी ऑपरेशंस कंसोल',
    email: 'ईमेल',
    password: 'पासवर्ड',
    submit: 'साइन इन',
  },
  dashboard: {
    title: 'डैशबोर्ड',
    totalDrivers: 'कुल ड्राइवर',
    onlineDrivers: 'अभी ऑनलाइन',
    totalRiders: 'कुल राइडर',
    ridesToday: 'आज की सवारियां',
    completedRides: 'पूर्ण सवारियां',
    activeRides: 'सक्रिय सवारियां',
    recentRides: 'हाल की सवारियां',
  },
  drivers: {
    title: 'ड्राइवर',
    name: 'नाम',
    phone: 'फ़ोन',
    status: 'स्थिति',
    approved: 'स्वीकृत',
    rides: 'सवारियां',
    vehicle: 'वाहन',
    founder: 'संस्थापक',
    approve: 'स्वीकृत करें',
    revoke: 'रद्द करें',
    addDriver: 'ड्राइवर जोड़ें',
    email: 'ईमेल',
    password: 'अस्थायी पासवर्ड',
    city: 'शहर',
    vehicleTypeLabel: 'वाहन प्रकार',
    regNo: 'वाहन रजि. नं.',
    model: 'मॉडल',
    color: 'रंग',
    create: 'ड्राइवर बनाएं',
    created: 'ड्राइवर बनाया गया',
  },
  account: {
    title: 'मेरा खाता',
    profile: 'प्रोफ़ाइल',
    name: 'पूरा नाम',
    email: 'ईमेल',
    role: 'भूमिका',
    regions: 'क्षेत्र',
    noRegions: 'कोई क्षेत्र नहीं सौंपा गया',
    save: 'सहेजें',
    saved: 'सहेजा गया',
    changePassword: 'पासवर्ड बदलें',
    newPassword: 'नया पासवर्ड',
    passwordChanged: 'पासवर्ड अपडेट किया गया',
  },
  riders: {
    title: 'राइडर',
    name: 'नाम',
    phone: 'फ़ोन',
    joined: 'शामिल हुए',
    rides: 'सवारियां',
  },
  rides: {
    title: 'सवारियां',
    rider: 'राइडर',
    driver: 'ड्राइवर',
    status: 'स्थिति',
    fare: 'किराया',
    pickup: 'पिकअप',
    drop: 'ड्रॉप',
    when: 'कब',
  },
  fares: {
    title: 'किराया कॉन्फ़िगरेशन',
    vehicleType: 'वाहन प्रकार',
    baseFare: 'आधार किराया (₹)',
    perKm: 'प्रति कि.मी. (₹)',
    perMin: 'प्रति मिनट (₹)',
    minFare: 'न्यूनतम किराया (₹)',
    save: 'बदलाव सहेजें',
    saved: 'सहेजा गया',
    region: 'क्षेत्र',
    global: 'वैश्विक डिफ़ॉल्ट',
    country: 'देश',
    state: 'राज्य',
    city: 'शहर',
    optional: 'वैकल्पिक',
    addScope: 'किसी क्षेत्र के लिए किराया जोड़ें',
    create: 'किराया जोड़ें',
    created: 'किराया जोड़ा गया',
    remove: 'हटाएं',
    removeConfirm: 'यह क्षेत्रीय किराया हटाएं? अगला व्यापक किराया लागू होगा।',
    noScopes: 'आपको अभी कोई किराया क्षेत्र नहीं सौंपा गया है। किसी सुपर एडमिन से कहें।',
  },
  support: {
    title: 'सहायता टिकट',
    user: 'उपयोगकर्ता',
    subject: 'विषय',
    message: 'संदेश',
    status: 'स्थिति',
    when: 'कब',
    empty: 'कोई सहायता टिकट नहीं',
    priority: 'प्राथमिकता',
    resolve: 'हल करें',
    reopen: 'फिर से खोलें',
    priorityLow: 'कम',
    priorityNormal: 'सामान्य',
    priorityHigh: 'उच्च',
    priorityUrgent: 'अत्यावश्यक',
    openOnly: 'खुले',
    all: 'सभी',
  },
  profile: {
    overview: 'अवलोकन',
    documents: 'दस्तावेज़',
    ridesTab: 'सवारियां',
    ratings: 'रेटिंग',
    earnings: 'कमाई',
    subscriptions: 'सदस्यता',
    wallet: 'वॉलेट',
    manager: 'प्रबंधक',
    vehicle: 'वाहन',
    gender: 'लिंग',
    joined: 'शामिल हुए',
    totalRides: 'कुल सवारियां',
    rating: 'रेटिंग',
    balance: 'वॉलेट शेष',
    earningsTotal: 'कुल कमाई',
    blocked: 'अवरुद्ध',
    blockUser: 'अवरुद्ध करें',
    unblockUser: 'अनब्लॉक करें',
    blockReason: 'कारण (वैकल्पिक)',
    blockConfirm: 'इस उपयोगकर्ता को अवरुद्ध करें? वे ऐप का उपयोग नहीं कर पाएंगे।',
    unblockConfirm: 'इस उपयोगकर्ता को अनब्लॉक करें?',
    approveDoc: 'स्वीकृत करें',
    rejectDoc: 'अस्वीकार करें',
    reviewNote: 'समीक्षा नोट (वैकल्पिक)',
    paid: 'भुगतान किया',
    unpaid: 'अवैतनिक',
    noDocuments: 'कोई दस्तावेज़ अपलोड नहीं',
    noRides: 'अभी तक कोई सवारी नहीं',
    noRatings: 'अभी तक कोई रेटिंग नहीं',
    noSubscriptions: 'कोई सदस्यता नहीं',
    noTransactions: 'कोई लेनदेन नहीं',
  },
  onboarding: {
    title: 'ड्राइवर ऑनबोर्डिंग',
    subtitle: 'स्वीकृति की प्रतीक्षा कर रहे ड्राइवर',
    allClear: 'कोई ड्राइवर स्वीकृति के लिए लंबित नहीं',
    review: 'समीक्षा करें',
  },
  staff: {
    title: 'स्टाफ और भूमिकाएं',
    addStaff: 'स्टाफ सदस्य जोड़ें',
    name: 'पूरा नाम',
    email: 'ईमेल',
    password: 'अस्थायी पासवर्ड',
    role: 'भूमिका',
    roleSuperAdmin: 'सुपर एडमिन',
    roleAdmin: 'एडमिन',
    roleSupport: 'सहायता',
    create: 'स्टाफ बनाएं',
    created: 'स्टाफ सदस्य बनाया गया',
    you: 'आप',
    regions: 'क्षेत्र',
    allRegions: 'पूर्ण पहुंच (सभी क्षेत्र)',
    noRegions: 'कोई क्षेत्र नहीं सौंपा गया',
    addRegion: 'क्षेत्र जोड़ें',
    removeRegion: 'क्षेत्र हटाएं',
    country: 'देश',
    state: 'राज्य',
    city: 'शहर',
    regionHint: 'एडमिन केवल अपने सौंपे गए क्षेत्रों के भीतर किराया संपादित कर सकते हैं।',
  },
  money: {
    title: 'राजस्व और सदस्यता',
    subtitle: '₹69/दिन ड्राइवर सदस्यता — सवारी का हर रुपया ड्राइवर को',
    collectedToday: 'आज एकत्र',
    paid: 'भुगतान किया',
    unpaid: 'अवैतनिक',
    refunded: 'आज रिफंड',
    walletFloat: 'वॉलेट फ्लोट',
    collectionRate: 'संग्रह दर',
    last14Days: 'पिछले 14 दिन',
    driver: 'ड्राइवर',
    city: 'शहर',
    amount: 'राशि',
    method: 'तरीका',
    wallet: 'वॉलेट',
    cash: 'नकद / UPI',
    all: 'सभी',
    status: 'स्थिति',
  },
  analytics: {
    title: 'विश्लेषण',
    daily: 'दैनिक',
    monthly: 'मासिक',
    quarterly: 'त्रैमासिक',
    yearly: 'वार्षिक',
    completedRides: 'पूर्ण सवारियां',
    driverEarnings: 'ड्राइवर कमाई',
    platformRevenue: 'प्लेटफॉर्म राजस्व',
    ridesOverTime: 'समय के साथ सवारियां',
    revenueOverTime: 'समय के साथ राजस्व',
    cityPerformance: 'शहर अनुसार प्रदर्शन',
    city: 'शहर',
    drivers: 'ड्राइवर',
    online: 'ऑनलाइन',
    rides: 'सवारियां',
    avgRating: 'औसत रेटिंग',
    leaderboards: 'लीडरबोर्ड',
    topByRides: 'सर्वाधिक सवारियां',
    topByRating: 'सर्वश्रेष्ठ रेटेड',
    needsAttention: 'ध्यान आवश्यक',
    noData: 'इस अवधि के लिए कोई डेटा नहीं',
  },
  ratings: {
    title: 'रेटिंग और समीक्षाएं',
    subtitle: 'राइडर और ड्राइवर प्रतिक्रिया',
    all: 'सभी रेटिंग',
    lowOnly: 'कम रेटिंग (≤ 2★)',
    from: 'से',
    to: 'को',
    comment: 'टिप्पणी',
    when: 'कब',
    noRatings: 'कोई रेटिंग नहीं मिली',
  },
  search: {
    title: 'खोज',
    placeholder: 'ड्राइवर और राइडर खोजें…',
    drivers: 'ड्राइवर',
    riders: 'राइडर',
    noResults: 'कोई मेल नहीं मिला',
    prompt: 'खोजने के लिए नाम या फ़ोन नंबर टाइप करें',
  },
  common: {
    yes: 'हाँ',
    no: 'नहीं',
    none: 'कोई नहीं',
    loading: 'लोड हो रहा है…',
    search: 'नाम या फ़ोन से खोजें',
    back: 'वापस',
    success: 'हो गया',
    failed: 'कार्रवाई विफल — कृपया पुनः प्रयास करें',
    save: 'सहेजें',
    cancel: 'रद्द करें',
  },
};

const dictionaries: Record<Locale, Dictionary> = { en, te, hi };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}
