// AUTOMATICALLY GENERATED: location from saved link.
Map.setCenter(264.8, 34.8, 4)

// =====================================================================
// Historical Temperature Time Series Extraction (1998-2015)
// Location: Islamabad Centroid (0.25° grid matching)
// Datasets: 1. NASA/GDDP-CMIP6 (Historical GCM Runs, Daily)
//           2. ECMWF/ERA5_LAND/HOURLY (Observed/Reanalysis, Hourly)
// =====================================================================

// ---- 1. STUDY POINT & SETTINGS -----------------------------------------
var lon = 73.0479;
var lat = 33.6844;
var point = ee.Geometry.Point([lon, lat]);

var startDate = '1998-01-01';
var endDate = '2015-12-31'; // Note: NEX-GDDP historical ends in 2014/2015 depending on model

// ---- 2. NASA NEX-GDDP-CMIP6 HISTORICAL DAILY ----------------------------
var nasaDaily = ee.ImageCollection('NASA/GDDP-CMIP6')
  .filter(ee.Filter.eq('scenario', 'historical'))
  .filterDate(startDate, endDate);

// Apply backup logic to calculate 'tas' if missing from 'tasmax' and 'tasmin'
var processedNasa = nasaDaily.map(function(image) {
  var hasTas = image.bandNames().contains('tas');
  var tasCalculated = image.expression('(b("tasmax") + b("tasmin")) / 2').rename('tas');
  var tasBand = ee.Image(ee.Algorithms.If(hasTas, image.select('tas'), tasCalculated));
  return image.select([]).addBands(tasBand).copyProperties(image, ['model', 'scenario']);
});

// Extract NASA Time Series
var nasaSeries = ee.FeatureCollection(processedNasa.map(function (img) {
  var stats = img.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 25000 // ~0.25 degrees
  });
  
  var celsius = ee.Number(stats.get('tas')).subtract(273.15);
  
  return ee.Feature(point, {
    'date_time': img.date().format('YYYY-MM-dd'),
    'dataset': 'NASA_GDDP_Historical',
    'model': img.get('model'),
    'value_C': celsius
    });
}));

// ---- 3. ERA5-LAND HOURLY -----------------------------------------------
var era5Hourly = ee.ImageCollection('ECMWF/ERA5_LAND/HOURLY')
  .filterDate(startDate, endDate)
  .select('temperature_2m');

// Extract ERA5 Time Series
var era5Series = ee.FeatureCollection(era5Hourly.map(function (img) {
  var stats = img.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 9000 // Native ERA5-Land resolution (~9km)
  });
  
  var celsius = ee.Number(stats.get('temperature_2m')).subtract(273.15);
  
  return ee.Feature(point, {
    'date_time': img.date().format('YYYY-MM-dd HH:mm'),
    'dataset': 'ERA5_Land_Hourly',
    'model': 'Observed_Reanalysis',
    'value_C': celsius
  });
}));

// ---- 4. EXPORT TO DRIVE AS CSV -----------------------------------------
Export.table.toDrive({
  collection: nasaSeries,
  description: 'NASA_GDDP_Historical_Daily_1998_2015',
  fileFormat: 'CSV'
});

Export.table.toDrive({
  collection: era5Series,
  description: 'ERA5_Land_Hourly_1998_2015',
  fileFormat: 'CSV'
});