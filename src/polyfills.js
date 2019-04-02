// Polyfills

global.MutationObserver = function MutationObserver() {
  // https://github.com/tmpvar/jsdom/issues/639
  return {
    observe() {
      return [];
    },
    takeRecords() {
      return [];
    },
  };
};

window.scrollTo = function() {};