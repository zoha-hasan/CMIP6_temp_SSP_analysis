// AUTOMATICALLY GENERATED: location from saved link.
Map.setCenter(264.8, 34.8, 4)

// =====================================================================
// Daily CMIP6 temperature time series at a point (0.25° grid cell)
// Dataset: NASA/GDDP-CMIP6 (NEX-GDDP-CMIP6), bias-corrected, statistically
// downscaled CMIP6 GCM output, native 0.25° x 0.25°, daily, 1950-2100.
// Scenarios extracted: SSP2-4.5 and SSP5-8.5, 2015-2100.
// =====================================================================

// ---- 1. STUDY POINT ----------------------------------------------------
// Replace with the centroid coordinates of YOUR 0.25° tile / grid cell.
var lon = 73.0479;
var lat = 33.6844;
var point = ee.Geometry.Point([lon, lat]);

// ---- 2. SETTINGS --------------------------------------------------------
// Temperature band: 'tas' = daily mean, 'tasmax' = daily max, 'tasmin' = daily min
var band = 'tas';            // <-- EDIT if you want max/min instead of mean

// Define the two custom date ranges to keep the CSV size manageable
var range1 = ee.Filter.date('2040-01-01', '2050-12-31');
var range2 = ee.Filter.date('2070-01-01', '2080-12-31');
var dateFilter = ee.Filter.or(range1, range2);

// ---- 3. LOAD + FILTER -----------------------------------------------------
var cmip6 = ee.ImageCollection('NASA/GDDP-CMIP6');

function getScenarioCollection (scenarioName) {
  var collection = cmip6
    .filter(ee.Filter.eq('scenario', scenarioName))
    .filter(dateFilter); // Only loads 2040-2050 and 2070-2080
    
  // Safely handle the missing 'tas' data by calculating it if it's missing
  if (band === 'tas') {
    collection = collection.map(function(image) {
      // 1. Check if 'tas' exists in this specific image
      var hasTas = image.bandNames().contains('tas');
      
      // 2. Create the backup formula: (tasmax + tasmin) / 2
      var tasCalculated = image.expression('(b("tasmax") + b("tasmin")) / 2').rename('tas');
      
      // 3. If tas exists, use it. If not, use the backup formula
      var tasBand = ee.Image(ee.Algorithms.If(hasTas, image.select('tas'), tasCalculated));
      
      // 4. Return the cleaned image with its metadata intact
      return image.select([]).addBands(tasBand);
    });
  } else {
    collection = collection.select(band);
  }
  
  return collection;
}

var ssp245 = getScenarioCollection('ssp245');
var ssp585 = getScenarioCollection('ssp585');

print('ssp245 image count:', ssp245.size());
print('ssp585 image count:', ssp585.size());

// ---- 4. EXTRACT DAILY TIME SERIES AT THE POINT -----------------------------
function extractSeries(collection, scenarioLabel) {
  return ee.FeatureCollection(collection.map(function (img) {
    var stats = img.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point,
      crs: img.projection(),
      scale: img.projection().nominalScale()
    });

    var celsius = ee.Number(stats.get(band)).subtract(273.15);

    return ee.Feature(point, {
      'date': img.date().format('YYYY-MM-dd'),
      'scenario': scenarioLabel,
      'model': img.get('model'),
      'band': band,
      'value_C': celsius
    });
  }));
}

var series245 = extractSeries(ssp245, 'ssp245');
var series585 = extractSeries(ssp585, 'ssp585');

// ---- 5. EXPORT TO DRIVE AS CSV ---------------------------------------------
Export.table.toDrive({
  collection: series245,
  description: band + '_all_models_ssp245_2015_2100',
  fileFormat: 'CSV'
});

Export.table.toDrive({
  collection: series585,
  description: band + '_all_models_ssp585_2015_2100',
  fileFormat: 'CSV'
});
