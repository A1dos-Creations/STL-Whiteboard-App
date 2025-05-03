import { v4 as uuidv4 } from 'uuid';

export const generateUniqueId = () => {
  return uuidv4();
};

// Add other helper functions if needed