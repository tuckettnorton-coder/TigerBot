import calculatorModal from '../calculator.js';

// Keep the legacy calc_modal custom ID working while reusing the maintained
// calculator handler instead of importing the deleted calculateModals.js file.
export default {
  name: 'calc_modal',
  execute: calculatorModal.execute,
};
