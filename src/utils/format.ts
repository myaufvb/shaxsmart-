export const formatPrice = (price: number | undefined | null): string => {
  if (price === undefined || price === null || isNaN(price)) return '0 сум';
  return `${Math.round(price).toLocaleString('ru-RU')} сум`;
};

export const USD_TO_UZS_DEFAULT_RATE = 12800; // 1 USD = 12 800 UZS

export const convertUsdToUzs = (usdAmount: number, rate: number = USD_TO_UZS_DEFAULT_RATE): number => {
  return Math.round(usdAmount * rate);
};
