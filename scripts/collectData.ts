import { BusDataCollector } from '../src/services/dataCollector';

async function collectData() {
  console.log('🔄 Manually collecting bus data...');

  const collector = new BusDataCollector();
  await collector.collectAndStoreReadings();

  console.log('✅ Data collection complete!');
}

// Run data collection
collectData();
