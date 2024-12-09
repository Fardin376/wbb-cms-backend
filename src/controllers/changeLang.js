const getFieldsByLanguage = (lang) => ({
  title: lang === 'bn' ? '$title.bn' : '$title.en',
  heading: lang === 'bn' ? '$heading.bn' : '$heading.en',
  summary: lang === 'bn' ? '$summary.bn' : '$summary.en',
});


module.exports = getFieldsByLanguage