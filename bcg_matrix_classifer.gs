// Constants
var SPREADSHEET_URL = "GOOGLE_SHEET_URL"; // Replace with your Google Sheet URL
var SHEET_NAME = "Sheet1"; // Default sheet name
// Enter time duration below. Possibilities:
// TODAY | YESTERDAY | LAST_7_DAYS | LAST_WEEK | LAST_BUSINESS_WEEK |
// LAST_14_DAYS | LAST_30_DAYS | THIS_WEEK_SUN_TODAY |
var TIME_DURATION = "LAST_30_DAYS"; // Default lookback window

function main() {
  var products = getProductsData();
  var quartiles = calculateQuartiles(products);
  var classifiedProducts = classifyProducts(products, quartiles);
  writeToSpreadsheet(classifiedProducts);
}

function getProductsData() {
  // Placeholder for actual Google Ads API query
  var query = "SELECT OfferId, Impressions, ConversionValue, Cost " +
              "FROM SHOPPING_PERFORMANCE_REPORT " +
              "DURING " + TIME_DURATION;
  var report = AdsApp.report(query);
  var rows = report.rows();
  var productsData = [];

  while (rows.hasNext()) {
    var row = rows.next();
    var impressions = parseInt(row['Impressions'], 10);
    var conversionValue = parseFloat(row['ConversionValue']);
    var cost = parseFloat(row['Cost']);
    var roas = cost > 0 ? conversionValue / cost : 0;

    productsData.push({
      'productId': row['OfferId'],
      'impressions': impressions,
      'roas': roas
    });
  }

  return productsData;
}

function calculateQuartiles(products) {
  var impressions = products.map(function(product) { return product.impressions; });
  var roas = products.map(function(product) { return product.roas; });

  impressions.sort(function(a, b) { return a - b; });
  roas.sort(function(a, b) { return a - b; });

  return {
    'impressions': getQuartiles(impressions),
    'roas': getQuartiles(roas)
  };
}

function getQuartiles(data) {
  var quartiles = {};
  var len = data.length;
  quartiles.first = data[Math.floor(len * 0.25)];
  quartiles.second = data[Math.floor(len * 0.5)];
  quartiles.third = data[Math.floor(len * 0.75)];
  return quartiles;
}

function classifyProducts(products, quartiles) {
  return products.map(function(product) {
    // Classify as 'Zombie' if both Impressions and ROAS are zero or not greater than the first quartile
    if ((product.impressions === 0 && product.roas === 0) ||
        (product.impressions <= quartiles.impressions.first && product.roas <= quartiles.roas.first)) {
      return {
        'productId': product.productId,
        'category': 'Zombie'
      };
    }

    // Determine the quartile group for Impressions
    var impressionGroup = product.impressions > quartiles.impressions.third ? 'top' :
                          product.impressions > quartiles.impressions.first ? 'mid' : 'bottom';

    // Determine the quartile group for ROAS
    var roasGroup = product.roas > quartiles.roas.third ? 'top' :
                    product.roas > quartiles.roas.first ? 'mid' : 'bottom';

    // Classify based on the quartile group
    var category = 'Zombie'; // Default to 'Zombie'
    if (impressionGroup === 'top' && roasGroup === 'top') {
      category = 'Hero';
    } else if (impressionGroup !== 'top' && roasGroup === 'top') {
      category = 'Sidekick';
    } else if (impressionGroup === 'top' && roasGroup !== 'top') {
      category = 'Villain';
    }

    return {
      'productId': product.productId,
      'category': category,
      'impressions': product.impressions,
      'roas': product.roas
    };
  });
}

function writeToSpreadsheet(classifiedProducts) {
  var spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);
  sheet.clearContents(); // Clear the existing contents
  var headerRange = sheet.getRange(1, 1, 1, 4);
  headerRange.setValues([['id', 'custom_label', 'impressions','roas']]);

  var dataRange = sheet.getRange(2, 1, classifiedProducts.length, 4);
  var values = classifiedProducts.map(function(product) {
    return [product.productId, product.category, product.impressions, product.roas];
  });
  dataRange.setValues(values);
}

