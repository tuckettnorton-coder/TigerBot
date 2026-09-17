import calculateModalHandler from '../../../handlers/calculateModals.js';

export default {
  name: 'ticket_calc_modal',
  execute: calculateModalHandler.execute || calculateModalHandler,
};
