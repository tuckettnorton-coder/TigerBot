export const TICKET_TYPES = {
  buying_selling_spawners: {
    label: 'Buying/Selling Spawners', emoji: '💸', description: 'Click this to buy/Sell Skeletons', categoryName: 'Buyer/Sellar',
    pingRoles: ['1505252058591138004', 'Buyer/Seller'],
    welcomeMessage: '{user} Welcome a @Buyer/Seller <@&1505252058591138004> will get to you shortly.',
    form: [
      { id: 'ign', label: 'IGN', required: true, placeholder: 'IGN' },
      { id: 'buy_or_sell', label: 'Buy or Sell', required: true, placeholder: 'Buy or Sell' },
      { id: 'amount', label: 'Amount', required: true, placeholder: 'Amount' },
      { id: 'spawner_type', label: 'What type of spawner?', required: true, placeholder: 'what type of spawner?' },
    ],
  },
  claim_giveaway: {
    label: 'Claim Giveaway', emoji: '🎉', description: 'Click this to claim Giveaway', categoryName: 'Giveaway',
    pingRoles: ['1505252058591138004', '1536860897509900389'],
    welcomeMessage: '{user} Welcome a <@&1536860897509900389> <@&1505252058591138004> will get to you shortly.',
    form: [
      { id: 'hosted_by', label: 'Who hosted the giveaway?', required: true, placeholder: 'Enter here' },
      { id: 'win_ss', label: 'Send a SS of the win in ticket', required: true, placeholder: 'Yes/Ok' },
      { id: 'ign', label: 'IGN', required: true, placeholder: 'IGN' },
    ],
  },
  report_staff: {
    label: 'Report Staff', emoji: '⚠️', description: 'Click this to Report Staff', categoryName: 'Staff report',
    pingRoles: ['Admin', 'Head | Manager'],
    welcomeMessage: '{user} Welcome a @Head | Manager @Admin will get to you shortly.',
    form: [
      { id: 'which_staff', label: 'What staff?', required: true, placeholder: 'Enter your reason' },
      { id: 'what_happened', label: 'What happened', required: true, placeholder: 'What happened' },
    ],
  },
  partner: {
    label: 'Partner', emoji: '🤝', description: 'Click this if you would like to Partner', categoryName: 'Partners',
    pingRoles: ['1517213956190638160', '1536860331370877038'],
    accessRoles: ['1536860331370877038', '1505252058591138004'],
    welcomeMessage: '{user} Welcome a <@&1517213956190638160> <@&1536860331370877038> will get to you shortly.',
    form: [
      { id: 'server_member_count', label: 'What is your server member count?', required: true, placeholder: 'Enter your server member count' },
      { id: 'donutsmp_relation', label: 'Is it Donut SMP related?', required: true, placeholder: 'Yes/No' },
      { id: 'server_ad', label: 'Send your ad immediately in the ticket once created.', required: true, placeholder: 'Yes/Ok' },
    ],
  },
  support: {
    label: 'Support', emoji: '🆘', description: 'Click this for Support', categoryName: 'General support',
    pingRoles: ['1505252058591138004', '1536860897509900389'],
    welcomeMessage: '{user} Welcome a <@&1536860897509900389> <@&1505252058591138004> will get to you shortly.',
    form: [
      { id: 'support_topic', label: 'What do you need support with?', required: true, placeholder: 'Enter your reason' },
      { id: 'extra', label: 'Anything extra?', required: true, placeholder: '' },
    ],
  },
  digging_services: {
    label: 'Digging services', emoji: '⛏️', description: 'Click this for Digging services', categoryName: 'Building/Diging',
    pingRoles: ['1505252058591138004', '1536861272610709534', '1536860897509900389', '1517213500655796265'],
    welcomeMessage: '{user} Welcome a <@&1517213500655796265> <@&1536861272610709534> will get to you shortly.',
    form: [
      { id: 'area_size', label: 'What size of area? (width X length X height)', required: true, placeholder: 'Enter here' },
      { id: 'has_area', label: 'Do you have a area?', required: true, placeholder: 'Yes/No' },
      { id: 'region', label: 'Do you want a certain region?', required: true, placeholder: 'No/Asia/East/Eu central/Eu west/Oceaniae/...'},
      { id: 'good_chords', label: 'Do you want good chords?', required: true, placeholder: 'Yes/No' },
      { id: 'ign', label: 'IGN', required: true, placeholder: 'IGN' },
    ],
  },
  building_services: {
    label: 'Building services', emoji: '🏠', description: 'Click this for Building services', categoryName: 'Building/Diging',
    pingRoles: ['1505252058591138004', '1536861272610709534', '1536860897509900389', '1517213500655796265'],
    welcomeMessage: '{user} Welcome a <@&1517213500655796265> <@&1536861272610709534> will get to you shortly.',
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
    pingRoles: ['1505252058591138004', 'Buyer/Seller'],
    welcomeMessage: '{user} Welcome a @Buyer/Seller <@&1505252058591138004> will get to you shortly.',
    form: [
      { id: 'your_ign', label: 'Your IGN', required: true, placeholder: 'Your IGN' },
      { id: 'person_ign', label: "Person's IGN", required: true, placeholder: "Person's IGN" },
      { id: 'what_needs_mm', label: 'What needs a middleman?', required: true, placeholder: 'Enter here' },
      { id: 'money_involved', label: 'How much money involved?', required: true, placeholder: 'Enter here' },
    ],
  },
  advertisement: {
    label: 'Advertisement', emoji: '💰', description: 'Click this for Advertisement services', categoryName: 'Advertisement',
    pingRoles: ['1505252058591138004', '1536860897509900389', 'Mod'],
    welcomeMessage: '{user} Welcome a <@&1536860897509900389> <@&1505252058591138004> @Mod will get to you shortly.',
    form: [
      { id: 'read_paid_ad', label: 'Have you read Paid-AD', required: true, placeholder: 'yes or no' },
      { id: 'ad_after', label: 'Send your ad in the ticket immediately after', required: true, placeholder: 'ok' },
      { id: 'ad_plan', label: 'What advertising plan?', required: true, placeholder: 'Enter here' },
    ],
  },
  sponsor_giveaway: {
    label: 'Sponsor a giveaway', emoji: '😽', description: 'Click this for to Sponsor a giveaway', categoryName: 'Sponsor a giveaway',
    pingRoles: ['1505252058591138004'],
    welcomeMessage: '{user} Welcome a <@&1505252058591138004> will get to you shortly.',
    form: [{ id: 'sponsor_amount', label: 'How much are you looking to sponsor?', required: true, placeholder: 'Enter your Here' }],
  },
};

export const TICKET_BY_ID = TICKET_TYPES;
