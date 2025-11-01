import { dataInjector } from '../src/services/realtimeDataInjector';

async function injectData() {
  console.log('🔄 Injecting real-time data...');
  await dataInjector.injectCurrentReadings();
  console.log('✅ Data injection complete!');
}

// Run injection
injectData();
