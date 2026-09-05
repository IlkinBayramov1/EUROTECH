const az = require('./az.json');
const en = require('./en.json');
const ru = require('./ru.json');

const dictionaries = { az, en, ru };

function getText(key, lang = 'az') {
  const selectedLang = ['az', 'en', 'ru'].includes(lang.toLowerCase()) ? lang.toLowerCase() : 'az';
  return dictionaries[selectedLang][key] || dictionaries['az'][key] || key;
}

module.exports = {
  getText,
  dictionaries,
};
