import MetricChart from './MetricChart';
import { buildSeries, type MetricDefinition } from './measurementMetrics';
import type { Measurement } from '@/types';

interface MetricChartGridProps {
  measurements: Measurement[];
  metrics: MetricDefinition[];
  // Mensaje cuando ninguna de estas medidas tiene datos todavía
  emptyMessage: string;
}

// Un gráfico por cada medida que tenga al menos un dato. Las que nunca se anotaron no ocupan espacio.
const MetricChartGrid = ({ measurements, metrics, emptyMessage }: MetricChartGridProps) => {
  const charts = metrics
    .map((metric) => ({ metric, points: buildSeries(measurements, metric.read) }))
    .filter(({ points }) => points.length > 0);

  if (charts.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {charts.map(({ metric, points }) => (
        <MetricChart
          key={metric.key}
          title={metric.label}
          unit={metric.unit}
          color={metric.color}
          decimals={metric.decimals}
          points={points}
        />
      ))}
    </div>
  );
};

export default MetricChartGrid;
