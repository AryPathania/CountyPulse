export interface DatasetMeta {
  dataset_id: string;
  name: string;
  description: string;
  classification: string;
  createdAt: string;
  rowsUpdatedAt: string;
}

/** Fetches all dataset metadata from the Socrata catalog */
export async function listMetadata(): Promise<DatasetMeta[]> {
  try {
    const response = await fetch('https://data.kingcounty.gov/api/catalog/v1?domain=data.kingcounty.gov');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
    }
    
    const json = await response.json();
    
    if (!json.results || !Array.isArray(json.results)) {
      throw new Error('Invalid response format: missing results array');
    }
    
    return json.results.map((r: any) => ({
      dataset_id: r.resource?.id || '',
      name: r.resource?.name || '',
      description: r.resource?.description || '',
      classification: r.classification || '',
      createdAt: r.resource?.createdAt || '',
      rowsUpdatedAt: r.resource?.rowsUpdatedAt || '',
    })).filter((meta: DatasetMeta) => meta.dataset_id && meta.name);
  } catch (error) {
    console.error('Error fetching Socrata metadata:', error);
    throw error;
  }
} 