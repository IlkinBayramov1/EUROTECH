function generateDossierNumber(destCountryCode = 'HU', originCountryCode = 'AZ') {
  const year = new Date().getFullYear();
  const random5Digits = Math.floor(10000 + Math.random() * 90000).toString();
  return `${destCountryCode.toUpperCase()}-${originCountryCode.toUpperCase()}-${year}-${random5Digits}`;
}

module.exports = {
  generateDossierNumber,
};
