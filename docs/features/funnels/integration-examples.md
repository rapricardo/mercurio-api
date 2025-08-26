# Exemplos Práticos de Integração - Funnel Analytics

Este documento complementa a documentação da API com exemplos práticos de integração para diferentes cenários de uso.

## 📋 Índice

1. [Dashboard Principal](#dashboard-principal)
2. [Análise de Performance](#análise-de-performance)
3. [A/B Testing Workflow](#ab-testing-workflow)
4. [Real-time Monitoring](#real-time-monitoring)
5. [Relatórios Automatizados](#relatórios-automatizados)
6. [Otimização de Conversão](#otimização-de-conversão)

---

## 📊 Dashboard Principal

### Caso de Uso: Dashboard de Visão Geral
Implementação de um dashboard que mostra métricas principais de múltiplos funnels.

#### Frontend React Component

```typescript
import React, { useState, useEffect } from 'react';
import { MercurioFunnelClient } from './mercurio-client';

interface FunnelDashboardProps {
  apiKey: string;
}

interface FunnelOverview {
  id: string;
  name: string;
  conversion_rate: number;
  total_conversions: number;
  total_entries: number;
  trend: 'up' | 'down' | 'stable';
}

export const FunnelDashboard: React.FC<FunnelDashboardProps> = ({ apiKey }) => {
  const [funnels, setFunnels] = useState<FunnelOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const client = new MercurioFunnelClient(apiKey);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // 1. Obter lista de funnels
      const funnelsResponse = await client.getFunnels({ limit: 20 });
      
      // 2. Carregar métricas para cada funnel
      const funnelOverviews = await Promise.all(
        funnelsResponse.data.map(async (funnel: any) => {
          try {
            // Período dos últimos 30 dias
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              .toISOString().split('T')[0];
            
            const conversionData = await client.getConversionAnalysis(
              funnel.id,
              startDate,
              endDate,
              { includeSegments: false, includeTimeseries: true }
            );

            // Calcular trend baseado nos últimos 7 pontos da série temporal
            const timeSeries = conversionData.time_series.slice(-7);
            const firstRate = timeSeries[0]?.conversion_rate || 0;
            const lastRate = timeSeries[timeSeries.length - 1]?.conversion_rate || 0;
            const trendThreshold = 0.5; // 0.5% threshold
            
            let trend: 'up' | 'down' | 'stable';
            if (lastRate > firstRate + trendThreshold) trend = 'up';
            else if (lastRate < firstRate - trendThreshold) trend = 'down';
            else trend = 'stable';

            return {
              id: funnel.id,
              name: funnel.name,
              conversion_rate: conversionData.overall_metrics.conversion_rate,
              total_conversions: conversionData.overall_metrics.total_conversions,
              total_entries: conversionData.overall_metrics.total_entries,
              trend
            };
          } catch (err) {
            console.error(`Error loading data for funnel ${funnel.id}:`, err);
            return null;
          }
        })
      );

      setFunnels(funnelOverviews.filter(Boolean) as FunnelOverview[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) return <div className="p-6">Carregando dashboard...</div>;
  if (error) return <div className="p-6 text-red-600">Erro: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard de Funnels</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total de Funnels</h3>
          <p className="text-2xl font-bold text-gray-900">{funnels.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Conversões Totais</h3>
          <p className="text-2xl font-bold text-gray-900">
            {funnels.reduce((sum, f) => sum + f.total_conversions, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Taxa Média</h3>
          <p className="text-2xl font-bold text-gray-900">
            {(funnels.reduce((sum, f) => sum + f.conversion_rate, 0) / funnels.length).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Funnels Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Funnel
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Taxa de Conversão
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Conversões
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entradas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tendência
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {funnels
              .sort((a, b) => b.conversion_rate - a.conversion_rate)
              .map((funnel) => (
                <tr key={funnel.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {funnel.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {funnel.id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {funnel.conversion_rate.toFixed(2)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {funnel.total_conversions.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {funnel.total_entries.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm ${getTrendColor(funnel.trend)}`}>
                      {getTrendIcon(funnel.trend)} {funnel.trend}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 flex justify-between items-center">
        <button 
          onClick={loadDashboardData}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Atualizar Dashboard
        </button>
        <p className="text-sm text-gray-500">
          Última atualização: {new Date().toLocaleString()}
        </p>
      </div>
    </div>
  );
};
```

---

## 📈 Análise de Performance

### Caso de Uso: Análise Detalhada de Funnel
Componente para análise aprofundada de um funnel específico.

#### React Component para Análise Detalhada

```typescript
import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface FunnelAnalysisProps {
  apiKey: string;
  funnelId: string;
}

export const FunnelAnalysis: React.FC<FunnelAnalysisProps> = ({ apiKey, funnelId }) => {
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [bottlenecks, setBottlenecks] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(true);

  const client = new MercurioFunnelClient(apiKey);

  useEffect(() => {
    loadAnalysisData();
  }, [funnelId, dateRange]);

  const loadAnalysisData = async () => {
    try {
      setLoading(true);
      
      // Carregar dados em paralelo
      const [conversionData, bottleneckData] = await Promise.all([
        client.getConversionAnalysis(
          funnelId,
          dateRange.startDate,
          dateRange.endDate,
          { 
            includeSegments: true, 
            includeTimeseries: true,
            granularity: 'daily'
          }
        ),
        client.getBottleneckAnalysis(funnelId)
      ]);

      setAnalysisData(conversionData);
      setBottlenecks(bottleneckData);
    } catch (err) {
      console.error('Error loading analysis data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTimeSeriesChartData = () => {
    if (!analysisData?.time_series) return null;

    return {
      labels: analysisData.time_series.map((point: any) => 
        new Date(point.date).toLocaleDateString()
      ),
      datasets: [
        {
          label: 'Taxa de Conversão (%)',
          data: analysisData.time_series.map((point: any) => point.conversion_rate),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
        },
        {
          label: 'Entradas',
          data: analysisData.time_series.map((point: any) => point.entries),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          yAxisID: 'y1',
        }
      ]
    };
  };

  const getStepAnalysisChartData = () => {
    if (!analysisData?.step_metrics) return null;

    return {
      labels: analysisData.step_metrics.map((step: any) => step.step_name),
      datasets: [
        {
          label: 'Taxa de Conclusão (%)',
          data: analysisData.step_metrics.map((step: any) => step.completion_rate),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
        },
        {
          label: 'Taxa de Drop-off (%)',
          data: analysisData.step_metrics.map((step: any) => step.drop_off_rate),
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  if (loading) return <div>Carregando análise...</div>;

  return (
    <div className="p-6 space-y-8">
      {/* Controles de Data */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Data Início</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Data Fim</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
          <button
            onClick={loadAnalysisData}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-6"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Taxa de Conversão</h3>
          <p className="text-3xl font-bold text-blue-600">
            {analysisData?.overall_metrics.conversion_rate.toFixed(2)}%
          </p>
          <p className="text-sm text-gray-600">
            IC: {analysisData?.overall_metrics.confidence_interval?.join(' - ')}%
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total de Entradas</h3>
          <p className="text-3xl font-bold text-green-600">
            {analysisData?.overall_metrics.total_entries.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Conversões</h3>
          <p className="text-3xl font-bold text-purple-600">
            {analysisData?.overall_metrics.total_conversions.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Gargalos Críticos</h3>
          <p className="text-3xl font-bold text-red-600">
            {bottlenecks?.detected_bottlenecks?.filter((b: any) => b.severity === 'critical').length || 0}
          </p>
        </div>
      </div>

      {/* Gráfico de Série Temporal */}
      {getTimeSeriesChartData() && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Tendência de Conversão</h3>
          <Line data={getTimeSeriesChartData()!} options={chartOptions} />
        </div>
      )}

      {/* Análise de Steps */}
      {getStepAnalysisChartData() && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Performance por Step</h3>
          <Bar data={getStepAnalysisChartData()!} />
        </div>
      )}

      {/* Análise de Segmentos */}
      {analysisData?.segment_analysis && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Análise por Segmentos</h3>
          {analysisData.segment_analysis.map((segmentGroup: any) => (
            <div key={segmentGroup.segment_type} className="mb-6">
              <h4 className="text-md font-medium mb-3 capitalize">
                {segmentGroup.segment_type.replace('_', ' ')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {segmentGroup.segments.map((segment: any) => (
                  <div key={segment.segment_value} className="border rounded p-4">
                    <h5 className="font-medium">{segment.segment_value}</h5>
                    <p className="text-sm text-gray-600">
                      {segment.entries.toLocaleString()} entradas
                    </p>
                    <p className="text-lg font-bold">
                      {segment.conversion_rate.toFixed(2)}%
                    </p>
                    <p className={`text-sm ${
                      segment.performance_vs_average.startsWith('+') 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {segment.performance_vs_average} vs média
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gargalos Detectados */}
      {bottlenecks?.detected_bottlenecks && bottlenecks.detected_bottlenecks.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Gargalos Detectados</h3>
          <div className="space-y-4">
            {bottlenecks.detected_bottlenecks.map((bottleneck: any) => (
              <div 
                key={bottleneck.bottleneck_id}
                className={`border-l-4 p-4 ${
                  bottleneck.severity === 'critical' 
                    ? 'border-red-500 bg-red-50' 
                    : bottleneck.severity === 'high'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-yellow-500 bg-yellow-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">
                    Step {bottleneck.step_number}: {bottleneck.step_name}
                  </h4>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    bottleneck.severity === 'critical'
                      ? 'bg-red-200 text-red-800'
                      : bottleneck.severity === 'high'
                      ? 'bg-orange-200 text-orange-800'
                      : 'bg-yellow-200 text-yellow-800'
                  }`}>
                    {bottleneck.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Drop-off atual: {bottleneck.metrics.current_drop_off_rate.toFixed(1)}% 
                  (média histórica: {bottleneck.metrics.historical_average.toFixed(1)}%)
                </p>
                <p className="text-sm text-gray-600">
                  Impacto: {bottleneck.impact_analysis.lost_conversions_estimate} conversões perdidas estimadas
                </p>
                <p className="text-sm text-gray-600">
                  Confiança: {bottleneck.detection_confidence}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recomendações */}
      {bottlenecks?.recommendations && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Recomendações</h3>
          <div className="space-y-4">
            {bottlenecks.recommendations.map((rec: any, index: number) => (
              <div key={index} className="border-l-4 border-blue-500 p-4 bg-blue-50">
                <h4 className="font-medium text-blue-900">{rec.title}</h4>
                <p className="text-sm text-blue-800 mt-1">{rec.description}</p>
                <div className="mt-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    rec.priority === 'high' 
                      ? 'bg-red-200 text-red-800'
                      : rec.priority === 'medium'
                      ? 'bg-yellow-200 text-yellow-800'
                      : 'bg-green-200 text-green-800'
                  }`}>
                    {rec.priority}
                  </span>
                  <span className="ml-2 text-sm text-blue-700">
                    Impacto: {rec.estimated_impact.potential_improvement}
                  </span>
                </div>
                {rec.suggested_actions && (
                  <ul className="mt-3 text-sm text-blue-800 list-disc list-inside">
                    {rec.suggested_actions.map((action: string, idx: number) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {analysisData?.insights && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Insights</h3>
          <div className="space-y-3">
            {analysisData.insights.map((insight: any, index: number) => (
              <div key={index} className="p-4 bg-gray-50 rounded">
                <h4 className="font-medium">{insight.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    insight.impact === 'high'
                      ? 'bg-red-200 text-red-800'
                      : insight.impact === 'medium'
                      ? 'bg-yellow-200 text-yellow-800'
                      : 'bg-green-200 text-green-800'
                  }`}>
                    {insight.impact} impact
                  </span>
                  <span className="text-sm text-gray-600">
                    {insight.confidence}% confiança
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## 🧪 A/B Testing Workflow

### Caso de Uso: Workflow Completo de A/B Testing

#### Hook React para A/B Testing

```typescript
import { useState, useEffect } from 'react';
import { MercurioFunnelClient } from './mercurio-client';

interface ABTestConfig {
  testName: string;
  hypothesis: string;
  controlFunnelId: string;
  variantFunnelId: string;
  confidenceLevel: 90 | 95 | 99;
  minimumSampleSize: number;
}

interface ABTestResult {
  isRunning: boolean;
  isConcluded: boolean;
  winner?: string;
  confidence: number;
  effectSize: number;
  comparisonData: any;
}

export const useABTest = (apiKey: string) => {
  const [client] = useState(() => new MercurioFunnelClient(apiKey));
  
  const runABTest = async (
    config: ABTestConfig,
    startDate: string,
    endDate: string
  ): Promise<ABTestResult> => {
    try {
      const comparisonRequest = {
        funnel_ids: [config.controlFunnelId, config.variantFunnelId],
        comparison_period: { start_date: startDate, end_date: endDate },
        baseline_funnel_id: config.controlFunnelId,
        ab_test_configuration: {
          test_name: config.testName,
          test_hypothesis: config.hypothesis,
          confidence_level: config.confidenceLevel,
          minimum_sample_size: config.minimumSampleSize,
          power_analysis: true
        },
        include_statistical_tests: true,
        include_conversion_rates: true,
        include_timing_analysis: true
      };

      const result = await client.compareFunnels(comparisonRequest);
      
      return {
        isRunning: !result.ab_test_results.test_status.is_conclusive,
        isConcluded: result.ab_test_results.test_status.is_conclusive,
        winner: result.ab_test_results.statistical_results.winner,
        confidence: result.ab_test_results.statistical_results.confidence_level_achieved,
        effectSize: result.ab_test_results.statistical_results.effect_size,
        comparisonData: result
      };
    } catch (error) {
      console.error('A/B Test error:', error);
      throw error;
    }
  };

  return { runABTest };
};

// Componente para Configuração e Execução de A/B Test
export const ABTestManager: React.FC<{ apiKey: string }> = ({ apiKey }) => {
  const { runABTest } = useABTest(apiKey);
  const [config, setConfig] = useState<ABTestConfig>({
    testName: '',
    hypothesis: '',
    controlFunnelId: '',
    variantFunnelId: '',
    confidenceLevel: 95,
    minimumSampleSize: 1000
  });
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [testResult, setTestResult] = useState<ABTestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRunTest = async () => {
    if (!config.testName || !config.controlFunnelId || !config.variantFunnelId) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);
      const result = await runABTest(config, dateRange.startDate, dateRange.endDate);
      setTestResult(result);
    } catch (error) {
      alert('Erro ao executar teste A/B: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getWinnerMessage = (result: ABTestResult) => {
    if (!result.isConcluded) {
      return {
        message: 'Teste ainda em execução. Mais dados necessários.',
        color: 'text-yellow-600'
      };
    }

    if (!result.winner) {
      return {
        message: 'Nenhuma diferença estatisticamente significativa detectada.',
        color: 'text-gray-600'
      };
    }

    const winnerName = result.winner === config.controlFunnelId ? 'Controle' : 'Variante';
    return {
      message: `${winnerName} é o vencedor com ${result.confidence}% de confiança!`,
      color: 'text-green-600'
    };
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">A/B Test Manager</h1>

      {/* Configuração do Teste */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Configuração do Teste</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome do Teste</label>
            <input
              type="text"
              value={config.testName}
              onChange={(e) => setConfig(prev => ({ ...prev, testName: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              placeholder="Ex: Otimização do formulário de signup"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nível de Confiança</label>
            <select
              value={config.confidenceLevel}
              onChange={(e) => setConfig(prev => ({ ...prev, confidenceLevel: Number(e.target.value) as 90 | 95 | 99 }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value={90}>90%</option>
              <option value={95}>95%</option>
              <option value={99}>99%</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Hipótese do Teste</label>
          <textarea
            value={config.hypothesis}
            onChange={(e) => setConfig(prev => ({ ...prev, hypothesis: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            rows={2}
            placeholder="Ex: O novo formulário simplificado aumentará a conversão em pelo menos 10%"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Funnel Controle (ID)</label>
            <input
              type="text"
              value={config.controlFunnelId}
              onChange={(e) => setConfig(prev => ({ ...prev, controlFunnelId: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              placeholder="123456789"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Funnel Variante (ID)</label>
            <input
              type="text"
              value={config.variantFunnelId}
              onChange={(e) => setConfig(prev => ({ ...prev, variantFunnelId: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              placeholder="987654321"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Data Início</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Data Fim</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Amostra Mínima</label>
            <input
              type="number"
              value={config.minimumSampleSize}
              onChange={(e) => setConfig(prev => ({ ...prev, minimumSampleSize: Number(e.target.value) }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              min="100"
              max="10000"
            />
          </div>
        </div>

        <button
          onClick={handleRunTest}
          disabled={loading}
          className={`w-full py-2 px-4 rounded-md font-medium ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white`}
        >
          {loading ? 'Executando Teste...' : 'Executar A/B Test'}
        </button>
      </div>

      {/* Resultados do Teste */}
      {testResult && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Resultados do Teste</h2>

          {/* Status do Teste */}
          <div className="mb-6">
            <div className={`p-4 rounded-lg ${testResult.isConcluded ? 'bg-green-50' : 'bg-yellow-50'}`}>
              <h3 className={`font-medium ${testResult.isConcluded ? 'text-green-900' : 'text-yellow-900'}`}>
                Status: {testResult.isConcluded ? 'Teste Concluído' : 'Teste em Andamento'}
              </h3>
              <p className={`text-sm mt-1 ${getWinnerMessage(testResult).color}`}>
                {getWinnerMessage(testResult).message}
              </p>
            </div>
          </div>

          {/* Métricas de Comparação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {testResult.comparisonData.funnels_compared.map((funnel: any) => (
              <div key={funnel.funnel_id} className={`p-4 rounded-lg border-2 ${
                funnel.funnel_id === testResult.winner 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-300 bg-white'
              }`}>
                <h4 className="font-medium text-lg">
                  {funnel.is_baseline ? 'Controle' : 'Variante'}
                  {funnel.funnel_id === testResult.winner && ' 🏆'}
                </h4>
                <p className="text-sm text-gray-600 mb-2">{funnel.funnel_name}</p>
                
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-500">Taxa de Conversão:</span>
                    <span className="ml-2 text-xl font-bold text-blue-600">
                      {funnel.overall_conversion_rate.toFixed(2)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Conversões:</span>
                    <span className="ml-2 font-medium">
                      {funnel.total_conversions.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Entradas:</span>
                    <span className="ml-2 font-medium">
                      {funnel.total_entries.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Análise Estatística */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h4 className="font-medium mb-3">Análise Estatística</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-gray-500">P-value:</span>
                <span className="ml-2 font-medium">
                  {testResult.comparisonData.statistical_comparison.pairwise_comparisons[0].comparison_metrics.p_value.toFixed(4)}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Effect Size:</span>
                <span className="ml-2 font-medium">
                  {testResult.effectSize.toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Lift de Conversão:</span>
                <span className="ml-2 font-medium text-green-600">
                  +{testResult.comparisonData.statistical_comparison.pairwise_comparisons[0].comparison_metrics.conversion_rate_lift.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Recomendação */}
          {testResult.isConcluded && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
              <h4 className="font-medium text-blue-900 mb-2">Recomendação</h4>
              <p className="text-blue-800">
                {testResult.comparisonData.ab_test_results.business_impact.implementation_recommendation === 'implement_winner'
                  ? `Implementar a variante vencedora. Lift projetado: +${testResult.comparisonData.statistical_comparison.pairwise_comparisons[0].comparison_metrics.conversion_rate_lift.toFixed(1)}%`
                  : 'Continuar coletando dados ou rever hipótese do teste.'
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

---

## ⚡ Real-time Monitoring

### Caso de Uso: Dashboard de Monitoramento em Tempo Real

#### Hook para Métricas ao Vivo

```typescript
import { useState, useEffect, useRef } from 'react';
import { MercurioFunnelClient } from './mercurio-client';

export const useLiveMetrics = (apiKey: string, funnelId: string, refreshInterval: number = 30) => {
  const [liveData, setLiveData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const clientRef = useRef(new MercurioFunnelClient(apiKey));

  const fetchLiveMetrics = async () => {
    try {
      const data = await clientRef.current.getLiveMetrics(funnelId, refreshInterval);
      setLiveData(data);
      setIsConnected(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch live metrics');
      setIsConnected(false);
    }
  };

  useEffect(() => {
    fetchLiveMetrics(); // Initial fetch
    
    intervalRef.current = setInterval(fetchLiveMetrics, refreshInterval * 1000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [funnelId, refreshInterval]);

  const disconnect = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsConnected(false);
  };

  const reconnect = () => {
    disconnect();
    fetchLiveMetrics();
    intervalRef.current = setInterval(fetchLiveMetrics, refreshInterval * 1000);
  };

  return {
    liveData,
    isConnected,
    error,
    disconnect,
    reconnect,
    lastUpdate: liveData?.timestamp
  };
};

// Componente de Dashboard ao Vivo
export const LiveDashboard: React.FC<{ apiKey: string; funnelId: string }> = ({ 
  apiKey, 
  funnelId 
}) => {
  const [refreshInterval, setRefreshInterval] = useState(30);
  const { liveData, isConnected, error, reconnect, lastUpdate } = useLiveMetrics(
    apiKey, 
    funnelId, 
    refreshInterval
  );

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusColor = (isConnected: boolean, error: string | null) => {
    if (error) return 'text-red-600';
    if (isConnected) return 'text-green-600';
    return 'text-yellow-600';
  };

  const getStatusText = (isConnected: boolean, error: string | null) => {
    if (error) return 'Erro de Conexão';
    if (isConnected) return 'Conectado';
    return 'Conectando...';
  };

  return (
    <div className="p-6">
      {/* Header com Status */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard ao Vivo - Funnel {funnelId}</h1>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              error ? 'bg-red-500' : isConnected ? 'bg-green-500' : 'bg-yellow-500'
            }`}></div>
            <span className={`text-sm font-medium ${getStatusColor(isConnected, error)}`}>
              {getStatusText(isConnected, error)}
            </span>
          </div>
          
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="text-sm border rounded px-2 py-1"
          >
            <option value={15}>15s</option>
            <option value={30}>30s</option>
            <option value={60}>1min</option>
            <option value={300}>5min</option>
          </select>
          
          <button
            onClick={reconnect}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            Reconectar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {liveData && (
        <>
          {/* Métricas Principais ao Vivo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
              <h3 className="text-sm font-medium text-gray-500">Usuários Ativos</h3>
              <p className="text-3xl font-bold text-blue-600">
                {liveData.live_metrics.current_active_users}
              </p>
              <p className="text-sm text-gray-600">agora mesmo</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
              <h3 className="text-sm font-medium text-gray-500">Entradas (1h)</h3>
              <p className="text-3xl font-bold text-green-600">
                {liveData.live_metrics.entries_last_hour}
              </p>
              <p className="text-sm text-gray-600">
                {liveData.performance_indicators.traffic_volume_vs_average}
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
              <h3 className="text-sm font-medium text-gray-500">Conversões (1h)</h3>
              <p className="text-3xl font-bold text-purple-600">
                {liveData.live_metrics.conversions_last_hour}
              </p>
              <p className="text-sm text-gray-600">
                {liveData.performance_indicators.conversion_rate_vs_average}
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-orange-500">
              <h3 className="text-sm font-medium text-gray-500">Taxa Atual</h3>
              <p className="text-3xl font-bold text-orange-600">
                {liveData.live_metrics.current_conversion_rate.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-600">em tempo real</p>
            </div>
          </div>

          {/* Distribuição por Steps */}
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-lg font-semibold mb-4">Distribuição de Usuários por Step</h3>
            <div className="space-y-3">
              {Object.entries(liveData.live_metrics.step_distribution).map(([step, count]) => {
                const percentage = ((count as number) / liveData.live_metrics.entries_last_hour) * 100;
                return (
                  <div key={step} className="flex items-center">
                    <div className="w-24 text-sm text-gray-600">{step.replace('_', ' ')}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-4 mr-4">
                      <div 
                        className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="w-16 text-sm font-medium text-right">
                      {count} ({percentage.toFixed(0)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trends em Tempo Real */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Taxa de Entrada (por minuto)</h3>
              <div className="h-24 flex items-end justify-between">
                {liveData.real_time_trends.entry_rate_per_minute.map((rate: number, index: number) => (
                  <div
                    key={index}
                    className="bg-green-500 w-6 rounded-t transition-all duration-300"
                    style={{ height: `${(rate / Math.max(...liveData.real_time_trends.entry_rate_per_minute)) * 100}%` }}
                    title={`${rate} entradas/min`}
                  ></div>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-2">Últimos 10 minutos</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Taxa de Conversão (por minuto)</h3>
              <div className="h-24 flex items-end justify-between">
                {liveData.real_time_trends.conversion_rate_trend.map((rate: number, index: number) => (
                  <div
                    key={index}
                    className="bg-purple-500 w-6 rounded-t transition-all duration-300"
                    style={{ height: `${(rate / Math.max(...liveData.real_time_trends.conversion_rate_trend)) * 100}%` }}
                    title={`${rate.toFixed(1)}%`}
                  ></div>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-2">Últimos 10 minutos</p>
            </div>
          </div>

          {/* Indicadores de Performance */}
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-lg font-semibold mb-4">Indicadores de Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <span className="text-sm text-gray-500">Volume vs Média:</span>
                <span className={`ml-2 font-medium ${
                  liveData.performance_indicators.traffic_volume_vs_average.startsWith('+')
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {liveData.performance_indicators.traffic_volume_vs_average}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Conversão vs Média:</span>
                <span className={`ml-2 font-medium ${
                  liveData.performance_indicators.conversion_rate_vs_average.startsWith('+')
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {liveData.performance_indicators.conversion_rate_vs_average}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Duração Média:</span>
                <span className="ml-2 font-medium">
                  {liveData.performance_indicators.average_session_duration}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Taxa de Rejeição:</span>
                <span className="ml-2 font-medium">
                  {liveData.performance_indicators.bounce_rate_last_hour.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Alertas */}
          {liveData.alerts && liveData.alerts.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
              <h3 className="font-medium text-yellow-800 mb-2">⚠️ Alertas Ativos</h3>
              <ul className="space-y-1">
                {liveData.alerts.map((alert: any, index: number) => (
                  <li key={index} className="text-sm text-yellow-800">
                    {alert.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer com Timestamp */}
          <div className="text-center text-sm text-gray-500">
            Última atualização: {lastUpdate && formatTime(lastUpdate)}
            <br />
            Próxima atualização em: {refreshInterval} segundos
          </div>
        </>
      )}
    </div>
  );
};
```

---

## 📊 Relatórios Automatizados

### Caso de Uso: Sistema de Relatórios Periódicos

#### Backend Service para Relatórios

```python
import asyncio
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Template

class FunnelReportGenerator:
    def __init__(self, api_key: str, base_url: str = "http://localhost:3001"):
        self.client = MercurioFunnelClient(api_key, base_url)
        
    async def generate_weekly_report(self, funnel_ids: List[str]) -> Dict[str, Any]:
        """Gerar relatório semanal para múltiplos funnels"""
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        
        report_data = {
            'period': f"{start_date} to {end_date}",
            'generated_at': datetime.now().isoformat(),
            'funnels': []
        }
        
        # Processar cada funnel em paralelo
        tasks = []
        for funnel_id in funnel_ids:
            tasks.append(self._analyze_funnel(funnel_id, start_date, end_date))
        
        funnel_analyses = await asyncio.gather(*tasks)
        report_data['funnels'] = funnel_analyses
        
        # Análise consolidada
        report_data['summary'] = self._generate_summary(funnel_analyses)
        
        return report_data
    
    async def _analyze_funnel(self, funnel_id: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """Análise completa de um funnel"""
        try:
            # Obter dados básicos do funnel
            funnel_details = self.client.get_funnel_details(funnel_id)
            
            # Análise de conversão
            conversion_data = self.client.get_conversion_analysis(
                funnel_id, start_date, end_date
            )
            
            # Análise de gargalos
            bottlenecks = self.client.get_bottleneck_analysis(funnel_id)
            
            # Análise de caminhos
            paths = self.client.get_path_analysis(funnel_id, start_date, end_date)
            
            return {
                'funnel_id': funnel_id,
                'name': funnel_details['name'],
                'description': funnel_details.get('description', ''),
                'performance': {
                    'conversion_rate': conversion_data['overall_metrics']['conversion_rate'],
                    'total_conversions': conversion_data['overall_metrics']['total_conversions'],
                    'total_entries': conversion_data['overall_metrics']['total_entries'],
                    'confidence_interval': conversion_data['overall_metrics']['confidence_interval']
                },
                'step_analysis': conversion_data['step_metrics'],
                'critical_bottlenecks': [
                    b for b in bottlenecks['detected_bottlenecks'] 
                    if b['severity'] == 'critical'
                ],
                'top_recommendations': bottlenecks['recommendations'][:3],
                'alternative_paths': len(paths['alternative_paths']),
                'optimization_opportunities': len(paths['path_optimization_opportunities']),
                'insights': conversion_data.get('insights', [])[:3]
            }
            
        except Exception as e:
            return {
                'funnel_id': funnel_id,
                'error': str(e),
                'name': f'Funnel {funnel_id}',
                'performance': None
            }
    
    def _generate_summary(self, funnel_analyses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Gerar resumo consolidado"""
        successful_analyses = [f for f in funnel_analyses if f.get('performance')]
        
        if not successful_analyses:
            return {'error': 'No successful analyses'}
        
        total_conversions = sum(f['performance']['total_conversions'] for f in successful_analyses)
        total_entries = sum(f['performance']['total_entries'] for f in successful_analyses)
        avg_conversion_rate = sum(f['performance']['conversion_rate'] for f in successful_analyses) / len(successful_analyses)
        
        # Identificar melhores e piores performers
        best_funnel = max(successful_analyses, key=lambda x: x['performance']['conversion_rate'])
        worst_funnel = min(successful_analyses, key=lambda x: x['performance']['conversion_rate'])
        
        # Contagem de problemas críticos
        total_critical_bottlenecks = sum(len(f['critical_bottlenecks']) for f in successful_analyses)
        
        return {
            'overview': {
                'total_funnels_analyzed': len(successful_analyses),
                'total_conversions': total_conversions,
                'total_entries': total_entries,
                'average_conversion_rate': round(avg_conversion_rate, 2),
                'total_critical_issues': total_critical_bottlenecks
            },
            'performance': {
                'best_performing_funnel': {
                    'name': best_funnel['name'],
                    'conversion_rate': best_funnel['performance']['conversion_rate'],
                    'funnel_id': best_funnel['funnel_id']
                },
                'worst_performing_funnel': {
                    'name': worst_funnel['name'],
                    'conversion_rate': worst_funnel['performance']['conversion_rate'],
                    'funnel_id': worst_funnel['funnel_id']
                },
                'performance_gap': round(
                    best_funnel['performance']['conversion_rate'] - worst_funnel['performance']['conversion_rate'], 2
                )
            },
            'action_items': self._generate_action_items(successful_analyses)
        }
    
    def _generate_action_items(self, funnel_analyses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Gerar itens de ação priorizados"""
        action_items = []
        
        for funnel in funnel_analyses:
            # Gargalos críticos
            for bottleneck in funnel['critical_bottlenecks']:
                action_items.append({
                    'type': 'critical_bottleneck',
                    'priority': 'high',
                    'funnel_name': funnel['name'],
                    'funnel_id': funnel['funnel_id'],
                    'title': f"Resolver gargalo crítico no Step {bottleneck['step_number']}",
                    'description': f"Drop-off de {bottleneck['metrics']['current_drop_off_rate']:.1f}% no step '{bottleneck['step_name']}'",
                    'estimated_impact': bottleneck['impact_analysis']['lost_conversions_estimate']
                })
            
            # Oportunidades de otimização
            if funnel['optimization_opportunities'] > 0:
                action_items.append({
                    'type': 'optimization_opportunity',
                    'priority': 'medium',
                    'funnel_name': funnel['name'],
                    'funnel_id': funnel['funnel_id'],
                    'title': f"Explorar {funnel['optimization_opportunities']} oportunidades de otimização",
                    'description': f"Caminhos alternativos identificados: {funnel['alternative_paths']}"
                })
        
        # Ordenar por prioridade e impacto
        priority_order = {'high': 3, 'medium': 2, 'low': 1}
        action_items.sort(
            key=lambda x: (
                priority_order.get(x['priority'], 0),
                x.get('estimated_impact', 0)
            ),
            reverse=True
        )
        
        return action_items[:10]  # Top 10 ações

# Email Report Template
EMAIL_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Relatório Semanal de Funnels</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
        .summary { background: #F3F4F6; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .metric { display: inline-block; margin: 10px 20px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #3B82F6; }
        .metric-label { font-size: 0.9em; color: #666; }
        .funnel-card { border: 1px solid #E5E7EB; margin: 10px 0; padding: 15px; border-radius: 8px; }
        .action-item { background: #FEF3C7; padding: 10px; margin: 5px 0; border-left: 4px solid #F59E0B; }
        .bottleneck { background: #FECACA; border-left-color: #EF4444; }
        .footer { text-align: center; color: #666; font-size: 0.9em; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Relatório Semanal de Funnels</h1>
        <p>{{ report.period }}</p>
    </div>

    <!-- Summary -->
    <div class="summary">
        <h2>📈 Resumo Executivo</h2>
        <div>
            <div class="metric">
                <div class="metric-value">{{ report.summary.overview.total_funnels_analyzed }}</div>
                <div class="metric-label">Funnels Analisados</div>
            </div>
            <div class="metric">
                <div class="metric-value">{{ "{:,}".format(report.summary.overview.total_conversions) }}</div>
                <div class="metric-label">Total de Conversões</div>
            </div>
            <div class="metric">
                <div class="metric-value">{{ report.summary.overview.average_conversion_rate }}%</div>
                <div class="metric-label">Taxa Média</div>
            </div>
            <div class="metric">
                <div class="metric-value">{{ report.summary.overview.total_critical_issues }}</div>
                <div class="metric-label">Problemas Críticos</div>
            </div>
        </div>
    </div>

    <!-- Performance Highlights -->
    <div class="summary">
        <h2>🏆 Destaques de Performance</h2>
        <p><strong>Melhor Performance:</strong> {{ report.summary.performance.best_performing_funnel.name }} 
           ({{ report.summary.performance.best_performing_funnel.conversion_rate }}%)</p>
        <p><strong>Maior Oportunidade:</strong> {{ report.summary.performance.worst_performing_funnel.name }} 
           ({{ report.summary.performance.worst_performing_funnel.conversion_rate }}%)</p>
        <p><strong>Gap de Performance:</strong> {{ report.summary.performance.performance_gap }}pp de diferença entre o melhor e pior funnel</p>
    </div>

    <!-- Action Items -->
    <div>
        <h2>⚡ Ações Prioritárias</h2>
        {% for action in report.summary.action_items[:5] %}
        <div class="action-item {% if action.type == 'critical_bottleneck' %}bottleneck{% endif %}">
            <h4>{{ action.title }}</h4>
            <p><strong>Funnel:</strong> {{ action.funnel_name }}</p>
            <p>{{ action.description }}</p>
            {% if action.estimated_impact %}
            <p><strong>Impacto Estimado:</strong> {{ action.estimated_impact }} conversões perdidas</p>
            {% endif %}
        </div>
        {% endfor %}
    </div>

    <!-- Detailed Funnel Analysis -->
    <div>
        <h2>📋 Análise Detalhada por Funnel</h2>
        {% for funnel in report.funnels %}
        {% if funnel.performance %}
        <div class="funnel-card">
            <h3>{{ funnel.name }}</h3>
            <p><strong>Taxa de Conversão:</strong> {{ funnel.performance.conversion_rate }}% 
               (IC: {{ funnel.performance.confidence_interval[0] }}% - {{ funnel.performance.confidence_interval[1] }}%)</p>
            <p><strong>Conversões:</strong> {{ "{:,}".format(funnel.performance.total_conversions) }} 
               de {{ "{:,}".format(funnel.performance.total_entries) }} entradas</p>
            
            {% if funnel.critical_bottlenecks %}
            <h4>🚨 Gargalos Críticos:</h4>
            <ul>
            {% for bottleneck in funnel.critical_bottlenecks %}
            <li>Step {{ bottleneck.step_number }}: {{ bottleneck.step_name }} 
                ({{ bottleneck.metrics.current_drop_off_rate }}% drop-off)</li>
            {% endfor %}
            </ul>
            {% endif %}

            {% if funnel.top_recommendations %}
            <h4>💡 Principais Recomendações:</h4>
            <ul>
            {% for rec in funnel.top_recommendations %}
            <li><strong>{{ rec.title }}</strong> - {{ rec.description[:100] }}...</li>
            {% endfor %}
            </ul>
            {% endif %}

            {% if funnel.insights %}
            <h4>📊 Insights:</h4>
            <ul>
            {% for insight in funnel.insights %}
            <li>{{ insight.title }} - {{ insight.description[:100] }}...</li>
            {% endfor %}
            </ul>
            {% endif %}
        </div>
        {% endif %}
        {% endfor %}
    </div>

    <div class="footer">
        <p>Relatório gerado em {{ report.generated_at[:19] }} pela API Mercurio</p>
        <p>Para análises detalhadas, acesse o dashboard completo.</p>
    </div>
</body>
</html>
"""

class EmailReportSender:
    def __init__(self, smtp_server: str, smtp_port: int, username: str, password: str):
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.username = username
        self.password = password
    
    def send_report(self, report_data: Dict[str, Any], recipients: List[str], 
                   subject: str = "Relatório Semanal de Funnels"):
        """Enviar relatório por email"""
        template = Template(EMAIL_TEMPLATE)
        html_content = template.render(report=report_data)
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = self.username
        msg['To'] = ', '.join(recipients)
        
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
            server.starttls()
            server.login(self.username, self.password)
            server.send_message(msg)

# Uso do sistema
async def main():
    # Configurar gerador de relatórios
    report_generator = FunnelReportGenerator('sua_api_key_aqui')
    
    # IDs dos funnels para análise
    funnel_ids = ['123456789', '987654321', '555666777']
    
    # Gerar relatório
    report_data = await report_generator.generate_weekly_report(funnel_ids)
    
    # Enviar por email
    email_sender = EmailReportSender(
        smtp_server='smtp.gmail.com',
        smtp_port=587,
        username='reports@suaempresa.com',
        password='sua_senha'
    )
    
    recipients = ['gerente@suaempresa.com', 'analytics@suaempresa.com']
    email_sender.send_report(report_data, recipients)
    
    print("Relatório enviado com sucesso!")

if __name__ == "__main__":
    asyncio.run(main())
```

---

Esta documentação de exemplos práticos complementa a API Reference fornecendo implementações reais para diferentes cenários de uso. Cada exemplo inclui:

✅ **Código funcional** pronto para usar  
✅ **Padrões de integração** recomendados  
✅ **Tratamento de erros** robusto  
✅ **Performance otimizada** com caching  
✅ **UI/UX patterns** para dashboards  

Com esta documentação completa, você tem todas as ferramentas necessárias para integrar os 16 endpoints implementados e criar dashboards poderosos de funnel analytics! 🚀