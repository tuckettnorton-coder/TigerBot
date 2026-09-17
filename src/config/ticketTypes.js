export const TICKET_TYPES = {
  buying_selling_spawners: {
    label: 'Buying/Selling Spawners', emoji: '💸', description: 'Click this to buy/Sell Skeletons', categoryName: 'Buyer/Sellar',
    pingRoles: ['Helper', 'Buyer/Seller', 'Owner'],
    welcomeMessage: '{user} Welcome a @Buyer/Seller @Helper will get to you shortly.',
    form: [
      { id: 'ign', label: 'IGN', required: true, placeholder: 'IGN' },
      { id: 'buy_or_sell', label: 'Buy or Sell', required: true, placeholder: 'Buy or Sell' },
      { id: 'amount', label: 'Amount', required: true, placeholder: 'Amount' },
      { id: 'spawner_type', label: 'What type of spawner?', required: true, placeholder: 'what type of spawner?' },
    ],
  },
  claim_giveaway: {
    label: 'Claim Giveaway', emoji: '🎉', description: 'Click this to claim Giveaway', categoryName: 'Giveaway',
    pingRoles: ['Helper', 'Trial | Helper', 'Owner'],
    welcomeMessage: '{user} Welcome a @Trial | Helper @Helper will get to you shortly.',
    form: [
      { id: 'hosted_by', label: 'Who hosted the giveaway?', required: true, placeholder: 'Enter here' },
      { id: 'win_ss', label: 'Send a SS of the win in ticket', required: true, placeholder: 'Yes/Ok' },
      { id: 'ign', label: 'IGN', required: true, placeholder: 'IGN' },
    ],
  },
  report_staff: {
    label: 'Report Staff', emoji: '⚠️', description: 'Click this to Report Staff', categoryName: 'Staff report',
    pingRoles: ['Admin', 'Head | Manager', 'Owner'],
    welcomeMessage: '{user} Welcome a @Head | Manager @Owner @Admin will get to you shortly.',
    form: [
      { id: 'which_staff', label: 'What staff?', required: true, placeholder: 'Enter your reason' },
      { id: 'what_happened', label: 'What happened', required: true, placeholder: 'What happened' },
    ],
  },
  partner: {
    label: 'Partner', emoji: '🤝', description: 'Click this if you would like to Partner', categoryName: 'Partners',
    pingRoles: ['Trial | PM', 'Helper', 'Partner | Manager', 'Trial | Helper', 'Owner'],
    welcomeMessage: '{user} Welcome a @Partner | Manager @Trial | PM @Helper @Trial | Helper will get to you shortly.',
    form: [],
  },
  support: {
    label: 'Support', emoji: '🆘', description: 'Click this for Support', categoryName: 'General support',
    pingRoles: ['Helper', 'Trial | Helper', 'Owner'],
    welcomeMessage: '{user} Welcome a @Trial | Helper @Helper will get to you shortly.',
    form: [
      { id: 'support_topic', label: 'What do you need support with?', required: true, placeholder: 'Enter your reason' },
      { id: 'extra', label: 'Anything extra?', required: true, placeholder: '' },
    ],
  },
  digging_services: {
    label: 'Digging services', emoji: '⛏️', description: 'Click this for Digging services', categoryName: 'Building/Diging',
    pingRoles: ['Helper', 'Trial | Builder/Digger', 'Trial | Helper', 'Builder/Digger', 'Owner'],
    welcomeMessage: '{user} Welcome a @Builder/Digger @Trial | Builder/Digger will get to you shortly.',
    form: [
      { id: 'area_size', label: 'What size of area? (width X length X height)', required: true, placeholder: 'Enter here' },
      { id: 'has_area', label: 'Do you have a area?', required: true, placeholder: 'Yes/No' },
      { id: 'region', label: 'Do you want a certain region?', required: true, placeholder: 'No/Asia/East/Eu central/Eu west/Oceaniae/...' },
      { id: 'good_chords', label: 'Do you want good chords?', required: true, placeholder: 'Yes/No' },
      { id: 'ign', label: 'IGN', required: true, placeholder: 'IGN' },
    ],
  },
  building_services: {
    label: 'Building services', emoji: '🏠', description: 'Click this for Building services', categoryName: 'Building/Diging',
    pingRoles: ['Helper', 'Trial | Builder/Digger', 'Trial | Helper', 'Builder/Digger', 'Owner'],
    welcomeMessage: '{user} Welcome a @Builder/Digger @Trial | Builder/Digger will get to you shortly.',
    form: [
      { id: 'what_built', label: 'What do you need built?', required: true, placeholder: 'Enter here' },
      { id: 'pay', label: 'How much are you looking to pay?', required: true, placeholder: 'Enter here' },
      { id: 'schematic', label: 'Do you have a schematic?', required: true, placeholder: 'Send schematic In ticket/ no' },
      { id: 'area_dug', label: 'Do you have an area doug out?', required: true, placeholder: 'Yes/No' },
      { id: 'ign', label: 'IGN', required: true, placeholder: 'IGN' },
    ],
  },
  middleman: {
    label: 'Middleman service', emoji: '🏦', description: 'Click this for Middleman service', categoryName: 'Middleman',
    pingRoles: ['Helper', 'Buyer/Seller', 'Owner'],
    welcomeMessage: '{user} Welcome a @Buyer/Seller @Helper will get to you shortly.',
    form: [
      { id: 'your_ign', label: 'Your IGN', required: true, placeholder: 'Your IGN' },
      { id: 'person_ign', label: "Person's IGN", required: true, placeholder: "Person's IGN" },
      { id: 'what_needs_mm', label: 'What needs a middleman?', required: true, placeholder: 'Enter here' },
      { id: 'money_involved', label: 'How much money involved?', required: true, placeholder: 'Enter here' },
    ],
  },
  advertisement: {
    label: 'Advertisement', emoji: '💰', description: 'Click this for Advertisement services', categoryName: 'Advertisement',
    pingRoles: ['Helper', 'Trial | Helper', 'Mod', 'Owner'],
    welcomeMessage: '{user} Welcome a @Trial | Helper @Helper @Mod will get to you shortly.',
    form: [
      { id: 'read_paid_ad', label: 'Have you read Paid-AD', required: true, placeholder: 'yes or no' },
      { id: 'ad_after', label: 'Send your ad in the ticket immediately after', required: true, placeholder: 'ok' },
      { id: 'ad_plan', label: 'What advertising plan?', required: true, placeholder: 'Enter here' },
      { id: 'member_count', label: 'How many members does your server have?', required: true, placeholder: '' },
    ],
  },
  sponsor_giveaway: {
    label: 'Sponsor a giveaway', emoji: '😽', description: 'Click this for to Sponsor a giveaway', categoryName: 'Sponsor a giveaway',
    pingRoles: ['Helper'],
    welcomeMessage: '{user} Welcome a @Helper will get to you shortly.',
    form: [{ id: 'sponsor_amount', label: 'How much are you looking to sponsor?', required: true, placeholder: 'Enter your Here' }],
  },
};

export const TICKET_BY_ID = TICKET_TYPES;
