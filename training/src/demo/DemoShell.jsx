import { syntheticCatalog } from '../../fixtures/catalog.js'
import TrainingExperience from '../components/TrainingExperience.jsx'

export const DEMO_SENTINEL = 'SYNTHETIC_TRAINING_DEMO_ONLY'

export default function DemoShell({ route }) {
  return <div data-preview={DEMO_SENTINEL}><TrainingExperience route={route} catalog={syntheticCatalog} sample databaseName="quicktrack-training-demo" /></div>
}
