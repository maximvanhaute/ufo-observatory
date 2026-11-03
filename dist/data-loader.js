// Partitioning keeps the larger Fabric snapshot within hosting/file-size limits.
// HTTP Content-Encoding decodes each precompressed JSON partition in browsers.
export async function loadReportPartitions(index,readPart){
  if(Array.isArray(index))return index;
  if(index?.schema_version!=='partitioned-v1'||!Array.isArray(index.parts))throw new Error('Unsupported report dataset format.');
  const chunks=await Promise.all(index.parts.map(readPart));
  if(chunks.some(part=>!Array.isArray(part)))throw new Error('Invalid report partition.');
  const reports=chunks.flat();
  if(reports.length!==index.total_reports)throw new Error('Report partitions do not reconcile with the dataset index.');
  return reports;
}
