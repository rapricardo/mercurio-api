# Funnel Analytics API Reference

Esta documentação completa cobre todos os endpoints implementados para análise de funnels na API Mercurio.

## 📋 Índice

1. [Autenticação](#autenticação)
2. [Endpoints de Configuração](#endpoints-de-configuração)
3. [Endpoints de Analytics Core](#endpoints-de-analytics-core)
4. [Endpoints de Analytics Avançados](#endpoints-de-analytics-avançados)
5. [Endpoints Real-time](#endpoints-real-time)
6. [Endpoints A/B Testing](#endpoints-ab-testing)
7. [Endpoints de Export](#endpoints-de-export)
8. [Health Check](#health-check)
9. [Códigos de Erro](#códigos-de-erro)
10. [Exemplos de Integração](#exemplos-de-integração)

---

## 🔐 Autenticação

Todos os endpoints (exceto `/health`) requerem autenticação via **HybridAuthGuard** que suporta:

### Método 1: API Key (Recomendado para integrações)
```http
Authorization: Bearer YOUR_API_KEY
```

### Método 2: Supabase JWT (Para aplicações web)
```http
Authorization: Bearer YOUR_SUPABASE_JWT_TOKEN
```

### Scopes Necessários
- `read:events` - Para todos os endpoints de consulta
- `write:funnels` - Para criação/edição de funnels
- `delete:funnels` - Para arquivamento de funnels

---

## 📊 Endpoints de Configuração

### 1. Criar Funnel

**`POST /v1/analytics/funnels`**

Cria um novo funnel com configuração de steps e regras de matching.

#### Request Body
```json
{
  "name": "Signup Conversion Funnel",
  "description": "Track user signup process from landing to confirmation",
  "time_window_days": 7,
  "steps": [
    {
      "order": 1,
      "type": "start",
      "label": "Landing Page Visit",
      "matching_rules": [
        {
          "kind": "page_view",
          "rules": {
            "page": {
              "operator": "equals",
              "value": "/signup"
            }
          }
        }
      ],
      "metadata": {
        "color": "#3B82F6",
        "description": "Users arriving at signup page"
      }
    },
    {
      "order": 2,
      "type": "event",
      "label": "Form Started",
      "matching_rules": [
        {
          "kind": "event",
          "rules": {
            "event_name": {
              "operator": "equals", 
              "value": "signup_form_started"
            }
          }
        }
      ]
    },
    {
      "order": 3,
      "type": "conversion",
      "label": "Account Created",
      "matching_rules": [
        {
          "kind": "event",
          "rules": {
            "event_name": {
              "operator": "equals",
              "value": "user_registered"
            }
          }
        }
      ]
    }
  ]
}
```

#### Response
```json
{
  "id": "123456789",
  "name": "Signup Conversion Funnel",
  "description": "Track user signup process from landing to confirmation",
  "time_window_days": 7,
  "status": "draft",
  "created_at": "2025-08-26T10:30:00.000Z",
  "updated_at": "2025-08-26T10:30:00.000Z",
  "current_version": {
    "id": "987654321",
    "version": 1,
    "state": "draft",
    "steps": [
      {
        "id": "step_001",
        "order": 1,
        "type": "start",
        "label": "Landing Page Visit",
        "matching_rules": [
          {
            "kind": "page_view",
            "rules": {
              "page": {
                "operator": "equals",
                "value": "/signup"
              }
            }
          }
        ],
        "metadata": {
          "color": "#3B82F6",
          "description": "Users arriving at signup page"
        }
      }
      // ... outros steps
    ]
  }
}
```

#### Códigos de Status
- `201` - Funnel criado com sucesso
- `400` - Dados inválidos (validação falhou)
- `401` - Não autenticado
- `403` - Sem permissão `write:funnels`
- `422` - Erro de negócio (ex: nome duplicado)

---

### 2. Listar Funnels

**`GET /v1/analytics/funnels`**

Lista todos os funnels do workspace com paginação e filtros.

#### Query Parameters
| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `page` | number | Não | 1 | Página da paginação |
| `limit` | number | Não | 20 | Itens por página (máx: 100) |
| `search` | string | Não | - | Busca por nome ou descrição |
| `state` | string | Não | - | Filtro por estado: `draft`, `published`, `archived` |
| `include_archived` | boolean | Não | false | Incluir funnels arquivados |

#### Exemplo de Request
```http
GET /v1/analytics/funnels?page=1&limit=10&search=signup&state=published
Authorization: Bearer YOUR_API_KEY
```

#### Response
```json
{
  "data": [
    {
      "id": "123456789",
      "name": "Signup Conversion Funnel",
      "description": "Track user signup process",
      "time_window_days": 7,
      "status": "published",
      "created_at": "2025-08-26T10:30:00.000Z",
      "updated_at": "2025-08-26T10:30:00.000Z",
      "stats": {
        "total_entries_last_30_days": 1250,
        "total_conversions_last_30_days": 187,
        "conversion_rate_last_30_days": 14.96,
        "steps_count": 3
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

---

### 3. Obter Detalhes do Funnel

**`GET /v1/analytics/funnels/:id`**

Obtém detalhes completos de um funnel específico.

#### Path Parameters
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | string | Sim | ID do funnel |

#### Response
```json
{
  "id": "123456789",
  "name": "Signup Conversion Funnel",
  "description": "Track user signup process from landing to confirmation",
  "time_window_days": 7,
  "status": "published",
  "created_at": "2025-08-26T10:30:00.000Z",
  "updated_at": "2025-08-26T10:30:00.000Z",
  "current_version": {
    "id": "987654321",
    "version": 1,
    "state": "published",
    "published_at": "2025-08-26T11:00:00.000Z",
    "steps": [
      {
        "id": "step_001",
        "order": 1,
        "type": "start",
        "label": "Landing Page Visit",
        "matching_rules": [
          {
            "kind": "page_view",
            "rules": {
              "page": {
                "operator": "equals",
                "value": "/signup"
              }
            }
          }
        ],
        "metadata": {
          "color": "#3B82F6",
          "description": "Users arriving at signup page"
        }
      }
      // ... outros steps
    ]
  },
  "recent_stats": {
    "last_7_days": {
      "entries": 245,
      "conversions": 38,
      "conversion_rate": 15.51
    },
    "last_30_days": {
      "entries": 1250,
      "conversions": 187,
      "conversion_rate": 14.96
    }
  }
}
```

#### Códigos de Status
- `200` - Sucesso
- `401` - Não autenticado
- `403` - Sem permissão `read:events`
- `404` - Funnel não encontrado

---

### 4. Atualizar Funnel

**`PATCH /v1/analytics/funnels/:id`**

Atualiza configuração de um funnel. Cria uma nova versão se o funnel estiver publicado.

#### Request Body (Parcial)
```json
{
  "name": "New Funnel Name",
  "description": "Updated description",
  "time_window_days": 14,
  "steps": [
    {
      "order": 1,
      "type": "start", 
      "label": "Updated Landing Page",
      "matching_rules": [
        {
          "kind": "page_view",
          "rules": {
            "page": {
              "operator": "equals",
              "value": "/new-signup"
            }
          }
        }
      ]
    }
    // ... outros steps
  ]
}
```

#### Response
Mesmo formato do endpoint GET, com os dados atualizados.

---

### 5. Arquivar Funnel

**`DELETE /v1/analytics/funnels/:id`**

Arquiva um funnel (soft delete). Os dados históricos são preservados.

#### Response
```json
{
  "message": "Funnel archived successfully",
  "archived_at": "2025-08-26T12:00:00.000Z"
}
```

#### Códigos de Status
- `200` - Funnel arquivado com sucesso
- `401` - Não autenticado
- `403` - Sem permissão `delete:funnels`
- `404` - Funnel não encontrado
- `409` - Funnel já arquivado

---

## 📈 Endpoints de Analytics Core

### 6. Análise de Conversão

**`GET /v1/analytics/funnels/:id/conversion`**

Análise completa de taxas de conversão com segmentação e séries temporais.

#### Query Parameters
| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `start_date` | string | Sim | - | Data início (YYYY-MM-DD) |
| `end_date` | string | Sim | - | Data fim (YYYY-MM-DD) |
| `include_segments` | boolean | Não | true | Incluir análise por segmentos |
| `include_timeseries` | boolean | Não | true | Incluir dados de série temporal |
| `timeseries_granularity` | string | Não | daily | Granularidade: `hourly`, `daily`, `weekly` |
| `statistical_confidence_level` | number | Não | 95 | Nível de confiança: 90, 95, 99 |

#### Exemplo de Request
```http
GET /v1/analytics/funnels/123456789/conversion?start_date=2025-08-01&end_date=2025-08-26&include_segments=true&timeseries_granularity=daily
Authorization: Bearer YOUR_API_KEY
```

#### Response
```json
{
  "funnel_id": "123456789",
  "analysis_period": {
    "start_date": "2025-08-01",
    "end_date": "2025-08-26",
    "days": 25
  },
  "overall_metrics": {
    "total_entries": 2450,
    "total_conversions": 368,
    "conversion_rate": 15.02,
    "confidence_interval": [13.8, 16.3],
    "statistical_significance": {
      "is_significant": true,
      "p_value": 0.001,
      "confidence_level": 95
    }
  },
  "step_metrics": [
    {
      "step_number": 1,
      "step_name": "Landing Page Visit",
      "entries": 2450,
      "completions": 2450,
      "completion_rate": 100.0,
      "drop_offs": 0,
      "drop_off_rate": 0.0
    },
    {
      "step_number": 2,
      "step_name": "Form Started",
      "entries": 2450,
      "completions": 1470,
      "completion_rate": 60.0,
      "drop_offs": 980,
      "drop_off_rate": 40.0
    },
    {
      "step_number": 3,
      "step_name": "Account Created",
      "entries": 1470,
      "completions": 368,
      "completion_rate": 25.03,
      "drop_offs": 1102,
      "drop_off_rate": 74.97
    }
  ],
  "segment_analysis": [
    {
      "segment_type": "device_type",
      "segments": [
        {
          "segment_value": "desktop",
          "entries": 1470,
          "conversions": 257,
          "conversion_rate": 17.48,
          "performance_vs_average": "+16.4%"
        },
        {
          "segment_value": "mobile",
          "entries": 980,
          "conversions": 111,
          "conversion_rate": 11.33,
          "performance_vs_average": "-24.6%"
        }
      ]
    },
    {
      "segment_type": "traffic_source",
      "segments": [
        {
          "segment_value": "organic_search",
          "entries": 1225,
          "conversions": 196,
          "conversion_rate": 16.0,
          "performance_vs_average": "+6.5%"
        },
        {
          "segment_value": "paid_social",
          "entries": 735,
          "conversions": 103,
          "conversion_rate": 14.01,
          "performance_vs_average": "-6.7%"
        }
      ]
    }
  ],
  "time_series": [
    {
      "date": "2025-08-01",
      "entries": 98,
      "conversions": 14,
      "conversion_rate": 14.29
    },
    {
      "date": "2025-08-02",
      "entries": 112,
      "conversions": 19,
      "conversion_rate": 16.96
    }
    // ... mais pontos
  ],
  "insights": [
    {
      "type": "performance_insight",
      "title": "Desktop significantly outperforms mobile",
      "description": "Desktop users convert 54% better than mobile users. Consider mobile optimization.",
      "confidence": 95,
      "impact": "high"
    }
  ],
  "query_performance": {
    "processing_time_ms": 156,
    "cache_hit": false,
    "data_freshness": "real_time"
  }
}
```

---

### 7. Análise de Drop-off

**`GET /v1/analytics/funnels/:id/dropoff`**

Análise detalhada de pontos de abandono com identificação de gargalos críticos.

#### Query Parameters
| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `start_date` | string | Sim | - | Data início (YYYY-MM-DD) |
| `end_date` | string | Sim | - | Data fim (YYYY-MM-DD) |
| `bottleneck_threshold` | number | Não | 30 | % mínimo de drop-off para considerar gargalo |
| `min_sample_size` | number | Não | 100 | Amostra mínima para análise confiável |
| `include_exit_paths` | boolean | Não | true | Incluir análise de caminhos de saída |

#### Response
```json
{
  "funnel_id": "123456789",
  "analysis_period": {
    "start_date": "2025-08-01",
    "end_date": "2025-08-26"
  },
  "summary": {
    "total_drop_offs": 2082,
    "overall_drop_off_rate": 84.98,
    "biggest_bottleneck_step": 2,
    "optimization_potential": 67,
    "estimated_additional_conversions": 147
  },
  "step_analysis": [
    {
      "step_number": 1,
      "step_name": "Landing Page Visit",
      "entries": 2450,
      "drop_offs": 0,
      "drop_off_rate": 0.0,
      "severity": "none",
      "is_critical_bottleneck": false
    },
    {
      "step_number": 2,
      "step_name": "Form Started",
      "entries": 2450,
      "drop_offs": 980,
      "drop_off_rate": 40.0,
      "severity": "high",
      "is_critical_bottleneck": true,
      "improvement_potential": 45,
      "confidence_interval": [38.2, 41.8]
    },
    {
      "step_number": 3,
      "step_name": "Account Created",
      "entries": 1470,
      "drop_offs": 1102,
      "drop_off_rate": 74.97,
      "severity": "critical",
      "is_critical_bottleneck": true,
      "improvement_potential": 67
    }
  ],
  "exit_paths": [
    {
      "exit_after_step": 2,
      "exit_page": "/signup",
      "exit_count": 654,
      "exit_percentage": 66.73,
      "common_patterns": [
        "stayed_less_than_30_seconds",
        "no_form_interaction",
        "mobile_device"
      ]
    },
    {
      "exit_after_step": 3,
      "exit_page": "/signup/confirm",
      "exit_count": 448,
      "exit_percentage": 40.65,
      "common_patterns": [
        "email_validation_failed",
        "form_errors",
        "timeout"
      ]
    }
  ],
  "recommendations": [
    {
      "priority": "high",
      "step_target": 2,
      "title": "Optimize signup form for mobile",
      "description": "Mobile users have 60% higher drop-off rate at form step",
      "potential_improvement": "15-25% reduction in drop-offs",
      "estimated_effort": "medium"
    },
    {
      "priority": "critical",
      "step_target": 3,
      "title": "Simplify email confirmation process",
      "description": "74% drop-off rate indicates major UX issues in confirmation step",
      "potential_improvement": "30-40% reduction in drop-offs",
      "estimated_effort": "high"
    }
  ]
}
```

---

### 8. Análise de Coortes

**`GET /v1/analytics/funnels/:id/cohorts`**

Análise de coortes para acompanhar grupos de usuários ao longo do tempo.

#### Query Parameters
| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `start_date` | string | Sim | - | Data início (YYYY-MM-DD) |
| `end_date` | string | Sim | - | Data fim (YYYY-MM-DD) |
| `cohort_period` | string | Sim | - | Período de coorte: `daily`, `weekly`, `monthly` |
| `include_retention` | boolean | Não | true | Incluir curvas de retenção |
| `confidence_level` | number | Não | 95 | Nível de confiança estatística |

#### Response
```json
{
  "funnel_id": "123456789",
  "cohort_period": "weekly",
  "analysis_period": {
    "start_date": "2025-08-01",
    "end_date": "2025-08-26"
  },
  "cohorts": [
    {
      "cohort_id": "2025-W31",
      "cohort_start_date": "2025-08-01",
      "cohort_size": 625,
      "conversion_metrics": {
        "immediate_conversions": 94,
        "conversion_rate": 15.04,
        "day_1_retention": 87.2,
        "day_7_retention": 76.8,
        "day_14_retention": 71.2
      },
      "step_progression": [
        {
          "step_number": 1,
          "completed_count": 625,
          "completion_rate": 100.0
        },
        {
          "step_number": 2,
          "completed_count": 375,
          "completion_rate": 60.0
        },
        {
          "step_number": 3,
          "completed_count": 94,
          "completion_rate": 25.07
        }
      ]
    },
    {
      "cohort_id": "2025-W32",
      "cohort_start_date": "2025-08-08",
      "cohort_size": 680,
      "conversion_metrics": {
        "immediate_conversions": 109,
        "conversion_rate": 16.03,
        "day_1_retention": 89.1,
        "day_7_retention": 78.4
      }
    }
    // ... mais coortes
  ],
  "cohort_comparison": [
    {
      "metric": "conversion_rate",
      "best_performing_cohort": "2025-W33",
      "worst_performing_cohort": "2025-W31",
      "improvement_percentage": 12.5,
      "statistical_significance": true,
      "confidence_level": 95
    }
  ],
  "retention_analysis": {
    "average_retention_curve": {
      "day_0": 100.0,
      "day_1": 88.1,
      "day_7": 77.6,
      "day_14": 71.8,
      "day_30": 68.2
    },
    "retention_insights": [
      {
        "insight": "Strong day-1 retention indicates good initial engagement",
        "confidence": 92
      },
      {
        "insight": "Week 33 cohort shows 12% better conversion rate",
        "confidence": 97
      }
    ]
  }
}
```

---

### 9. Análise de Tempo-para-Conversão

**`GET /v1/analytics/funnels/:id/timing`**

Análise de velocidade de conversão e distribuição de tempos.

#### Query Parameters
| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `start_date` | string | Sim | - | Data início (YYYY-MM-DD) |
| `end_date` | string | Sim | - | Data fim (YYYY-MM-DD) |
| `percentiles` | number[] | Não | [25, 50, 75, 90] | Percentis para calcular |
| `time_unit` | string | Não | minutes | Unidade: `seconds`, `minutes`, `hours`, `days` |
| `include_segments` | boolean | Não | true | Incluir análise por segmentos |

#### Response
```json
{
  "funnel_id": "123456789",
  "analysis_period": {
    "start_date": "2025-08-01", 
    "end_date": "2025-08-26"
  },
  "overall_timing": {
    "statistics": {
      "mean_minutes": 47.3,
      "median_minutes": 23.5,
      "std_dev_minutes": 125.8,
      "min_minutes": 0.5,
      "max_minutes": 2880.0
    },
    "percentiles": {
      "p25": 8.2,
      "p50": 23.5,
      "p75": 65.1,
      "p90": 180.3
    },
    "distribution": [
      {
        "time_bucket": "0-5 min",
        "count": 89,
        "percentage": 24.2
      },
      {
        "time_bucket": "5-30 min", 
        "count": 145,
        "percentage": 39.4
      },
      {
        "time_bucket": "30min-2h",
        "count": 98,
        "percentage": 26.6
      },
      {
        "time_bucket": "2h+",
        "count": 36,
        "percentage": 9.8
      }
    ]
  },
  "step_timing": [
    {
      "step_from": 1,
      "step_to": 2,
      "step_name": "Landing to Form Start",
      "average_time_minutes": 12.7,
      "median_time_minutes": 4.2,
      "percentiles": {
        "p50": 4.2,
        "p75": 15.8,
        "p90": 45.3
      }
    },
    {
      "step_from": 2,
      "step_to": 3,
      "step_name": "Form Start to Completion",
      "average_time_minutes": 34.6,
      "median_time_minutes": 19.3,
      "percentiles": {
        "p50": 19.3,
        "p75": 49.3,
        "p90": 134.7
      }
    }
  ],
  "conversion_velocity_trends": [
    {
      "date": "2025-08-01",
      "avg_time_minutes": 52.1,
      "median_time_minutes": 28.3,
      "velocity_score": 73
    },
    {
      "date": "2025-08-02", 
      "avg_time_minutes": 43.8,
      "median_time_minutes": 21.7,
      "velocity_score": 78
    }
    // ... mais pontos
  ],
  "segment_timing": [
    {
      "segment_type": "device_type",
      "segments": [
        {
          "segment_value": "desktop",
          "avg_time_minutes": 34.2,
          "median_time_minutes": 18.5,
          "performance": "fast"
        },
        {
          "segment_value": "mobile",
          "avg_time_minutes": 67.8,
          "median_time_minutes": 31.2,
          "performance": "slow"
        }
      ]
    }
  ],
  "insights": [
    {
      "type": "velocity_insight",
      "title": "Mobile users take 2x longer to convert",
      "description": "Mobile users average 67.8 minutes vs 34.2 minutes for desktop",
      "confidence": 94,
      "recommendation": "Optimize mobile form experience"
    }
  ]
}
```

---

## 🔬 Endpoints de Analytics Avançados

### 10. Detecção de Gargalos

**`GET /v1/analytics/funnels/:id/bottlenecks`**

Sistema avançado de detecção de gargalos com ML e recomendações automáticas.

#### Query Parameters
| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `time_window_hours` | number | Não | 24 | Janela de tempo para análise (1-168h) |
| `sensitivity_level` | string | Não | medium | Sensibilidade: `low`, `medium`, `high` |
| `include_recommendations` | boolean | Não | true | Incluir recomendações automáticas |
| `comparison_period_days` | number | Não | 7 | Período para comparação histórica |

#### Response
```json
{
  "funnel_id": "123456789",
  "analysis_timestamp": "2025-08-26T14:30:00.000Z",
  "analysis_window": {
    "hours": 24,
    "start_time": "2025-08-25T14:30:00.000Z",
    "end_time": "2025-08-26T14:30:00.000Z"
  },
  "detected_bottlenecks": [
    {
      "bottleneck_id": "btn_001",
      "step_number": 2,
      "step_name": "Form Started",
      "severity": "critical",
      "detection_confidence": 97,
      "metrics": {
        "current_drop_off_rate": 45.2,
        "historical_average": 35.8,
        "deviation_percentage": 26.3,
        "statistical_significance": true,
        "p_value": 0.001
      },
      "impact_analysis": {
        "affected_users_per_hour": 23,
        "lost_conversions_estimate": 156,
        "revenue_impact_estimate": 4680.0
      }
    }
  ],
  "performance_anomalies": [
    {
      "anomaly_type": "spike_in_exit_rate",
      "step_number": 3,
      "description": "Unusual increase in exits at confirmation step",
      "anomaly_score": 8.7,
      "first_detected": "2025-08-26T12:15:00.000Z",
      "potential_causes": [
        "server_response_time_increase",
        "external_api_issues",
        "ui_element_changes"
      ]
    }
  ],
  "recommendations": [
    {
      "recommendation_id": "rec_001",
      "priority": "high",
      "category": "user_experience",
      "title": "Investigate form validation issues",
      "description": "High drop-off rate suggests form validation problems or unclear requirements",
      "suggested_actions": [
        "Review form error messages for clarity",
        "Add real-time validation feedback", 
        "Simplify required fields",
        "A/B test form layout"
      ],
      "estimated_impact": {
        "potential_improvement": "15-25%",
        "confidence_level": 82
      },
      "implementation": {
        "difficulty": "medium",
        "estimated_hours": 16
      }
    }
  ],
  "trend_analysis": {
    "7_day_trend": "deteriorating",
    "performance_vs_baseline": -18.5,
    "trend_confidence": 89,
    "forecasted_next_24h": {
      "expected_drop_off_rate": 47.1,
      "confidence_interval": [44.2, 50.0]
    }
  }
}
```

---

### 11. Análise Multi-path

**`GET /v1/analytics/funnels/:id/paths`**

Análise de caminhos alternativos de conversão e oportunidades de otimização.

#### Query Parameters
| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `funnel_id` | string | Sim | - | ID do funnel (via path) |
| `start_date` | string | Não | -30 dias | Data início (YYYY-MM-DD) |
| `end_date` | string | Não | hoje | Data fim (YYYY-MM-DD) |
| `include_alternative_paths` | boolean | Não | true | Incluir análise de caminhos alternativos |
| `min_path_volume` | number | Não | 10 | Volume mínimo para considerar caminho |
| `max_path_length` | number | Não | 10 | Comprimento máximo de caminho |
| `include_efficiency_scoring` | boolean | Não | true | Incluir scoring de eficiência |
| `include_branching_analysis` | boolean | Não | true | Incluir análise de ramificações |

#### Response
```json
{
  "funnel_id": "123456789",
  "analysis_period": {
    "start_date": "2025-08-01",
    "end_date": "2025-08-26"
  },
  "analysis_timestamp": "2025-08-26T14:30:00.000Z",
  "conversion_paths": [
    {
      "path_id": "path_001",
      "path_name": "Standard Path",
      "path_sequence": [
        {
          "step_number": 1,
          "step_name": "Landing Page Visit",
          "completion_rate": 100.0
        },
        {
          "step_number": 2, 
          "step_name": "Form Started",
          "completion_rate": 60.0
        },
        {
          "step_number": 3,
          "step_name": "Account Created", 
          "completion_rate": 25.03
        }
      ],
      "metrics": {
        "total_users": 2450,
        "completed_users": 368,
        "completion_rate": 15.02,
        "average_time_minutes": 47.3,
        "efficiency_score": 67
      },
      "success_indicators": {
        "velocity": "medium",
        "completion_rate": "average",
        "user_experience": "good"
      }
    }
  ],
  "alternative_paths": [
    {
      "path_id": "alt_001",
      "path_name": "Direct to Form Path",
      "description": "Users who skip landing page and go directly to form",
      "path_sequence": [
        {
          "step_number": 2,
          "step_name": "Form Started (Direct)"
        },
        {
          "step_number": 3,
          "step_name": "Account Created"
        }
      ],
      "metrics": {
        "total_users": 125,
        "completed_users": 47,
        "completion_rate": 37.6,
        "average_time_minutes": 23.1,
        "efficiency_score": 89
      },
      "performance_comparison": {
        "vs_standard_path": "+150% conversion rate",
        "statistical_significance": true,
        "confidence_level": 96
      },
      "discovery_insights": [
        "Significantly higher conversion rate suggests landing page may be hindering conversion",
        "Shorter time to conversion indicates reduced friction",
        "Limited volume but high quality traffic"
      ]
    }
  ],
  "path_optimization_opportunities": [
    {
      "opportunity_id": "opt_001",
      "opportunity_type": "path_shortening",
      "title": "Consider direct-to-form option",
      "description": "Alternative path shows 150% better conversion rate when skipping landing page",
      "potential_impact": {
        "estimated_conversion_lift": "25-40%",
        "affected_user_percentage": 80,
        "confidence_level": 87
      },
      "implementation": {
        "difficulty": "low",
        "suggested_approach": "A/B test direct signup links in email campaigns",
        "estimated_effort_days": 3
      }
    }
  ],
  "branching_analysis": {
    "decision_points": [
      {
        "decision_point": "after_step_1",
        "branches": [
          {
            "branch_name": "continue_to_form",
            "user_count": 1470,
            "percentage": 60.0,
            "success_rate": 25.03
          },
          {
            "branch_name": "exit_immediately",
            "user_count": 980,
            "percentage": 40.0,
            "success_rate": 0.0
          }
        ],
        "optimization_potential": 85,
        "recommendations": [
          "Improve landing page engagement",
          "Add progressive disclosure",
          "Implement exit-intent overlays"
        ]
      }
    ],
    "merge_points": [
      {
        "merge_at_step": 3,
        "description": "All successful paths converge at account creation",
        "efficiency_analysis": {
          "average_efficiency": 73,
          "best_path_efficiency": 89,
          "improvement_potential": 22
        }
      }
    ]
  },
  "query_performance": {
    "processing_time_ms": 234,
    "cache_hit": false,
    "paths_analyzed": 1247,
    "alternative_paths_discovered": 3
  }
}
```

---

### 12. Análise de Atribuição

**`GET /v1/analytics/funnels/:id/attribution`**

Análise multi-touch de atribuição com múltiplos modelos e rastreamento cross-channel.

#### Query Parameters
| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `start_date` | string | Não | -30 dias | Data início (YYYY-MM-DD) |
| `end_date` | string | Não | hoje | Data fim (YYYY-MM-DD) |
| `attribution_models` | string[] | Não | ['first_touch', 'last_touch', 'linear', 'time_decay'] | Modelos a calcular |
| `cross_channel` | boolean | Não | true | Incluir análise cross-channel |
| `include_custom_model` | boolean | Não | false | Incluir modelo customizado |
| `custom_model_weights` | object | Não | - | Pesos para modelo custom |
| `dimension_breakdown` | string[] | Não | - | Dimensões: utm_source, device_type, etc. |
| `include_model_comparison` | boolean | Não | true | Incluir comparação entre modelos |

#### Response
```json
{
  "funnel_id": "123456789",
  "analysis_period": {
    "start_date": "2025-08-01",
    "end_date": "2025-08-26"
  },
  "analysis_timestamp": "2025-08-26T14:30:00.000Z",
  "attribution_results": [
    {
      "model_name": "first_touch",
      "model_configuration": null,
      "total_conversions": 368,
      "total_attributed_value": 0,
      "attribution_by_touchpoint": [
        {
          "touchpoint_id": "organic_search_google_none",
          "touchpoint_type": "organic_search",
          "touchpoint_details": {
            "utm_source": "google",
            "utm_medium": null,
            "utm_campaign": null,
            "referrer_domain": "google.com",
            "device_type": "desktop"
          },
          "attributed_conversions": 147,
          "attribution_percentage": 39.95,
          "position_analysis": {
            "first_touch_percentage": 39.95,
            "middle_touch_percentage": 0,
            "last_touch_percentage": 0,
            "avg_position_in_journey": 1.0
          },
          "effectiveness_metrics": {
            "conversion_rate": 15.8,
            "avg_time_to_conversion": 2340,
            "journey_completion_rate": 73.2,
            "bounce_rate": 26.8
          }
        },
        {
          "touchpoint_id": "paid_search_google_cpc",
          "touchpoint_type": "paid_search",
          "touchpoint_details": {
            "utm_source": "google",
            "utm_medium": "cpc",
            "utm_campaign": "signup-campaign",
            "referrer_domain": "google.com",
            "device_type": "mobile"
          },
          "attributed_conversions": 98,
          "attribution_percentage": 26.63,
          "position_analysis": {
            "first_touch_percentage": 26.63,
            "middle_touch_percentage": 0,
            "last_touch_percentage": 0,
            "avg_position_in_journey": 1.0
          }
        }
      ],
      "model_performance": {
        "attribution_accuracy_score": 85,
        "coverage_percentage": 95,
        "confidence_interval": [80, 90],
        "statistical_significance": 0.05
      },
      "top_performing_touchpoints": [
        {
          "touchpoint_id": "organic_search_google_none",
          "rank": 1,
          "attributed_conversions": 147,
          "attribution_percentage": 39.95,
          "efficiency_score": 85,
          "performance_indicators": {
            "high_converting": true,
            "cost_effective": true,
            "consistent_performer": true,
            "trending_up": true
          },
          "optimization_opportunities": {
            "increase_investment": true,
            "optimize_targeting": false,
            "improve_landing_page": false,
            "a_b_test_creative": true
          }
        }
      ],
      "attribution_insights": []
    },
    {
      "model_name": "last_touch",
      "total_conversions": 368,
      "attribution_by_touchpoint": [
        {
          "touchpoint_id": "direct_none_none",
          "touchpoint_type": "direct",
          "attributed_conversions": 156,
          "attribution_percentage": 42.39,
          "position_analysis": {
            "first_touch_percentage": 0,
            "middle_touch_percentage": 0,
            "last_touch_percentage": 42.39,
            "avg_position_in_journey": 2.8
          }
        }
      ]
    }
  ],
  "cross_model_comparison": [],
  "journey_attribution": {
    "typical_journey_patterns": [],
    "journey_complexity_analysis": {
      "avg_touchpoints_per_conversion": 3.5,
      "avg_journey_duration_days": 14,
      "multi_channel_percentage": 65,
      "single_channel_percentage": 35
    },
    "journey_effectiveness": {
      "shortest_converting_journeys": [],
      "longest_converting_journeys": [],
      "most_efficient_journeys": [],
      "least_efficient_journeys": []
    }
  },
  "conversion_credit_distribution": {
    "total_conversion_credit": 100,
    "by_channel_type": {},
    "by_touchpoint_position": {
      "first_touch_credit": 30,
      "middle_touches_credit": 40,
      "last_touch_credit": 25,
      "assist_touches_credit": 5
    },
    "by_journey_stage": {
      "awareness_stage_credit": 35,
      "consideration_stage_credit": 40,
      "decision_stage_credit": 25
    },
    "credit_concentration": {
      "top_10_percent_touchpoints_credit": 60,
      "attribution_gini_coefficient": 0.3,
      "diversification_score": 75
    }
  },
  "query_performance": {
    "processing_time_ms": 189,
    "cache_hit": false,
    "touchpoints_analyzed": 1450,
    "conversions_analyzed": 368
  }
}
```

---

## ⚡ Endpoints Real-time

### 13. Métricas ao Vivo

**`GET /v1/analytics/funnels/:id/live`**

Métricas em tempo real para dashboard com atualização automática.

#### Query Parameters
| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `refresh_interval` | number | Não | 30 | Intervalo de refresh em segundos (15-300) |

#### Response
```json
{
  "funnel_id": "123456789",
  "timestamp": "2025-08-26T14:30:00.000Z",
  "refresh_interval_seconds": 30,
  "live_metrics": {
    "current_active_users": 47,
    "entries_last_hour": 94,
    "conversions_last_hour": 14,
    "current_conversion_rate": 14.89,
    "step_distribution": {
      "step_1": 94,
      "step_2": 56,
      "step_3": 14
    }
  },
  "real_time_trends": {
    "entry_rate_per_minute": [3, 4, 2, 5, 3, 4, 3, 2, 4, 3],
    "conversion_rate_trend": [14.2, 15.1, 13.8, 14.9, 15.3, 14.7, 14.1, 15.8, 14.4, 14.9],
    "active_users_trend": [42, 45, 47, 44, 46, 49, 51, 48, 47, 47]
  },
  "performance_indicators": {
    "conversion_rate_vs_average": "+3.2%",
    "traffic_volume_vs_average": "+12.4%",
    "average_session_duration": "4m 32s",
    "bounce_rate_last_hour": 23.4
  },
  "alerts": []
}
```

---

### 14. Progressão Individual do Usuário

**`GET /v1/analytics/funnels/:id/users/:userId`**

Rastreamento detalhado da jornada individual de um usuário.

#### Path Parameters
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `userId` | string | Sim | ID do usuário ou anonymous_id |

#### Query Parameters
| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `type` | string | Não | anonymous_id | Tipo: `user_id` ou `anonymous_id` |

#### Response
```json
{
  "funnel_id": "123456789",
  "user_id": "a_abc123def456",
  "user_type": "anonymous_id",
  "journey_status": "in_progress",
  "current_step": 2,
  "progression": {
    "steps_completed": [
      {
        "step_number": 1,
        "step_name": "Landing Page Visit",
        "completed_at": "2025-08-26T14:15:23.000Z",
        "time_spent_seconds": 87,
        "completion_details": {
          "page_url": "/signup",
          "referrer": "https://google.com",
          "device_type": "desktop",
          "utm_params": {
            "utm_source": "google",
            "utm_medium": "organic"
          }
        }
      },
      {
        "step_number": 2,
        "step_name": "Form Started",
        "completed_at": "2025-08-26T14:16:50.000Z",
        "time_spent_seconds": 145,
        "completion_details": {
          "form_interactions": 3,
          "field_errors": 0,
          "progress_percentage": 60
        }
      }
    ],
    "next_step": {
      "step_number": 3,
      "step_name": "Account Created",
      "expected_completion_probability": 0.67,
      "average_time_to_complete": 420
    }
  },
  "user_characteristics": {
    "session_id": "s_session123",
    "first_seen": "2025-08-26T14:15:23.000Z",
    "last_activity": "2025-08-26T14:18:15.000Z",
    "total_session_time": 172,
    "page_views": 2,
    "events_triggered": 4,
    "device_info": {
      "device_type": "desktop",
      "browser": "chrome",
      "os": "macos"
    }
  },
  "journey_insights": {
    "journey_health": "good",
    "completion_likelihood": "high",
    "potential_drop_off_risk": "low",
    "optimization_suggestions": [
      "User is progressing normally",
      "Strong engagement indicators"
    ]
  }
}
```

---

## 🧪 Endpoints A/B Testing

### 15. Comparação de Funnels

**`POST /v1/analytics/funnels/compare`**

Comparação estatística entre múltiplos funnels com análise A/B testing.

#### Request Body
```json
{
  "funnel_ids": ["123456789", "987654321"],
  "comparison_period": {
    "start_date": "2025-08-01",
    "end_date": "2025-08-26"
  },
  "baseline_funnel_id": "123456789",
  "ab_test_configuration": {
    "test_name": "Signup Flow A/B Test",
    "test_hypothesis": "New simplified form will increase conversion rate by at least 10%",
    "confidence_level": 95,
    "minimum_sample_size": 1000,
    "power_analysis": true,
    "expected_effect_size": 0.1
  },
  "include_statistical_tests": true,
  "include_conversion_rates": true,
  "include_drop_off_analysis": true,
  "include_timing_analysis": true,
  "normalize_for_traffic": true,
  "time_series_granularity": "daily"
}
```

#### Response
```json
{
  "comparison_id": "cmp_1724681400_abc123def",
  "comparison_timestamp": "2025-08-26T14:30:00.000Z",
  "comparison_period": {
    "start_date": "2025-08-01",
    "end_date": "2025-08-26"
  },
  "funnels_compared": [
    {
      "funnel_id": "123456789",
      "funnel_name": "Original Signup Flow",
      "funnel_description": "Current signup process",
      "steps_count": 3,
      "is_baseline": true,
      "total_entries": 2450,
      "total_conversions": 368,
      "overall_conversion_rate": 15.02,
      "traffic_volume_rank": 1,
      "traffic_quality_score": 75,
      "user_engagement_score": 78
    },
    {
      "funnel_id": "987654321",
      "funnel_name": "Simplified Signup Flow",
      "funnel_description": "New simplified signup process",
      "steps_count": 2,
      "is_baseline": false,
      "total_entries": 1890,
      "total_conversions": 425,
      "overall_conversion_rate": 22.49,
      "traffic_volume_rank": 2,
      "traffic_quality_score": 85,
      "user_engagement_score": 87
    }
  ],
  "baseline_funnel_id": "123456789",
  "statistical_comparison": {
    "overall_significance": {
      "is_statistically_significant": true,
      "confidence_level": 95,
      "p_value": 0.001,
      "chi_square_statistic": 45.7,
      "degrees_of_freedom": 1
    },
    "pairwise_comparisons": [
      {
        "funnel_a_id": "123456789",
        "funnel_b_id": "987654321",
        "comparison_metrics": {
          "conversion_rate_difference": 7.47,
          "conversion_rate_lift": 49.73,
          "confidence_interval": [5.2, 9.8],
          "statistical_significance": true,
          "p_value": 0.001
        },
        "practical_assessment": {
          "effect_size": 0.67,
          "business_significance": "substantial",
          "recommendation": "implement_winner"
        }
      }
    ],
    "multiple_comparison_correction": {
      "method": "benjamini_hochberg",
      "adjusted_alpha": 0.05,
      "significant_pairs_count": 1
    },
    "effect_size_analysis": {
      "eta_squared": 0.45,
      "practical_significance": "large",
      "business_impact_estimate": "high"
    }
  },
  "conversion_rate_comparison": {
    "step_by_step_comparison": [
      {
        "step_number": 1,
        "step_name": "Landing Page",
        "step_conversions": {
          "123456789": {
            "conversion_rate": 60.0,
            "entries": 2450,
            "conversions": 1470,
            "rank": 2,
            "vs_baseline_difference": 0.0
          },
          "987654321": {
            "conversion_rate": 78.3,
            "entries": 1890,
            "conversions": 1480,
            "rank": 1,
            "vs_baseline_difference": 18.3
          }
        },
        "step_insights": {
          "best_performing_funnel": "987654321",
          "worst_performing_funnel": "123456789",
          "performance_spread": 18.3,
          "optimization_potential": 85
        }
      }
    ],
    "overall_performance_ranking": [
      {
        "funnel_id": "987654321",
        "overall_rank": 1,
        "conversion_rate": 22.49,
        "performance_breakdown": {
          "traffic_acquisition_score": 85,
          "user_experience_score": 87,
          "conversion_optimization_score": 89,
          "retention_score": 82
        },
        "relative_performance": {
          "vs_baseline_lift": 49.73,
          "vs_average_lift": 49.73,
          "confidence_in_ranking": 97
        }
      }
    ],
    "conversion_efficiency_analysis": {
      "most_efficient_funnel": "987654321",
      "least_efficient_funnel": "123456789",
      "efficiency_gap_percentage": 7.47,
      "consistency_scores": {
        "123456789": 75,
        "987654321": 92
      }
    },
    "conversion_trends": {
      "123456789": {
        "trend_direction": "stable",
        "trend_strength": 0.1,
        "volatility_score": 25,
        "seasonal_patterns": false
      },
      "987654321": {
        "trend_direction": "stable", 
        "trend_strength": 0.1,
        "volatility_score": 15,
        "seasonal_patterns": false
      }
    }
  },
  "drop_off_comparison": {
    "step_by_step_dropoff": [],
    "critical_bottlenecks": {},
    "drop_off_pattern_analysis": {
      "consistent_patterns": [],
      "unique_challenges": {},
      "improvement_recommendations": {}
    }
  },
  "timing_comparison": {
    "overall_timing_metrics": {},
    "step_timing_comparison": [],
    "timing_insights": {
      "fastest_funnel": "987654321",
      "slowest_funnel": "123456789",
      "time_efficiency_gap": 0,
      "optimal_timing_recommendations": {}
    }
  },
  "ab_test_results": {
    "test_configuration": {
      "test_name": "Signup Flow A/B Test",
      "test_hypothesis": "New simplified form will increase conversion rate by at least 10%",
      "confidence_level": 95,
      "minimum_sample_size": 1000,
      "actual_sample_size": 4340
    },
    "test_status": {
      "is_conclusive": true,
      "has_sufficient_sample": true,
      "test_duration_days": 30,
      "recommended_duration_days": 45
    },
    "statistical_results": {
      "winner": "987654321",
      "confidence_level_achieved": 95,
      "p_value": 0.001,
      "effect_size": 0.67,
      "power_analysis": {
        "statistical_power": 0.95,
        "minimum_detectable_effect": 0.05,
        "actual_effect_observed": 0.67
      }
    },
    "business_impact": {
      "projected_conversion_lift": 49.73,
      "risk_assessment": "low",
      "implementation_recommendation": "implement_winner"
    }
  },
  "comparison_insights": [],
  "optimization_recommendations": [],
  "query_performance": {
    "processing_time_ms": 445,
    "cache_hit": false,
    "funnels_analyzed": 2,
    "total_events_processed": 18750
  }
}
```

---

## 📦 Endpoints de Export

### 17. Criar Export de Dados

**`POST /v1/analytics/funnels/:id/export`**

Cria um job de exportação dos dados de um funnel em múltiplos formatos (CSV, JSON, Excel) com opções de entrega via download ou email.

#### Parâmetros da URL
- `id` (string, obrigatório): ID do funnel

#### Request Body
```json
{
  "format": "csv",
  "export_type": "detailed",
  "delivery_method": "download",
  "email": "usuario@exemplo.com",
  "title": "Relatório de Conversão Q3 2024",
  "filters": {
    "start_date": "2024-08-01",
    "end_date": "2024-08-31",
    "segments": ["mobile_users", "paid_traffic"],
    "steps": [1, 2, 3],
    "include_cohorts": true,
    "include_attribution": true,
    "anonymize_data": false
  },
  "options": {
    "include_charts": true,
    "compress": true
  }
}
```

#### Campos do Request Body

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `format` | enum | ✅ | Formato do export: `"csv"`, `"json"`, `"excel"` |
| `export_type` | enum | ✅ | Tipo de dados: `"summary"`, `"detailed"`, `"raw_events"` |
| `delivery_method` | enum | ✅ | Método de entrega: `"download"`, `"email"` |
| `email` | string | ⚠️ | Email para entrega (obrigatório se `delivery_method="email"`) |
| `title` | string | ❌ | Título personalizado para o arquivo |
| `filters` | object | ❌ | Filtros para personalizar dados exportados |
| `filters.start_date` | string | ❌ | Data de início (formato ISO: YYYY-MM-DD) |
| `filters.end_date` | string | ❌ | Data de fim (formato ISO: YYYY-MM-DD) |
| `filters.segments` | array | ❌ | Lista de segmentos para filtrar |
| `filters.steps` | array | ❌ | Números dos steps para incluir |
| `filters.include_cohorts` | boolean | ❌ | Incluir análise de coortes (default: false) |
| `filters.include_attribution` | boolean | ❌ | Incluir dados de atribuição (default: false) |
| `filters.anonymize_data` | boolean | ❌ | Aplicar anonimização para compliance (default: false) |
| `options` | object | ❌ | Opções adicionais de formatação |

#### Response (202 Accepted)
```json
{
  "export_id": "exp_1a2b3c4d5e6f7g8h",
  "status": "processing",
  "metadata": {
    "total_records": 150000,
    "processed_records": 0,
    "estimated_file_size": 2048000,
    "estimated_completion": "2024-08-26T14:30:00.000Z",
    "started_at": "2024-08-26T14:00:00.000Z"
  },
  "export_config": {
    "format": "csv",
    "export_type": "detailed",
    "delivery_method": "download",
    "title": "Relatório de Conversão Q3 2024"
  }
}
```

#### Códigos de Status
- **202**: Export job criado com sucesso
- **400**: Dados inválidos no request
- **401**: Token de autenticação inválido  
- **403**: Permissão insuficiente
- **404**: Funnel não encontrado
- **429**: Rate limit excedido

---

### 18. Verificar Status do Export

**`GET /v1/analytics/exports/:exportId/status`**

Verifica o status e progresso de um job de exportação.

#### Parâmetros da URL
- `exportId` (string, obrigatório): ID do export retornado na criação

#### Response
```json
{
  "export_id": "exp_1a2b3c4d5e6f7g8h",
  "status": "completed",
  "progress_percent": 100,
  "metadata": {
    "total_records": 150000,
    "processed_records": 150000,
    "estimated_file_size": 2048000,
    "estimated_completion": "2024-08-26T14:30:00.000Z",
    "started_at": "2024-08-26T14:00:00.000Z",
    "completed_at": "2024-08-26T14:25:00.000Z"
  },
  "download_url": "https://api.mercurio.com/downloads/exports/exp_1a2b3c4d5e6f7g8h.csv",
  "download_expires_at": "2024-08-27T14:00:00.000Z"
}
```

#### Status Possíveis
- `"pending"`: Export na fila de processamento
- `"processing"`: Export em progresso
- `"completed"`: Export concluído com sucesso
- `"failed"`: Export falhou (veja `metadata.error_message`)
- `"expired"`: Download expirado

#### Campos da Response

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `export_id` | string | ID único do export |
| `status` | enum | Status atual do processamento |
| `progress_percent` | number | Progresso de 0-100% |
| `metadata.total_records` | number | Total de registros para processar |
| `metadata.processed_records` | number | Registros já processados |
| `metadata.estimated_file_size` | number | Tamanho estimado do arquivo (bytes) |
| `metadata.started_at` | string | Timestamp de início (ISO) |
| `metadata.completed_at` | string | Timestamp de conclusão (ISO) |
| `metadata.error_message` | string | Mensagem de erro (se status="failed") |
| `download_url` | string | URL para download (se delivery_method="download") |
| `download_expires_at` | string | Expiração do link de download (24h) |

#### Códigos de Status
- **200**: Status retornado com sucesso
- **400**: Export ID inválido
- **401**: Token de autenticação inválido
- **404**: Export não encontrado
- **429**: Rate limit excedido

---

## 🔍 Health Check

### 19. Status da API

**`GET /health`**

Verificação de saúde da API (não requer autenticação).

#### Response
```json
{
  "status": "healthy",
  "timestamp": "2025-08-26T14:30:00.000Z",
  "uptime": "2d 14h 32m",
  "version": "1.0.0",
  "environment": "production",
  "dependencies": {
    "database": {
      "status": "healthy",
      "response_time_ms": 12,
      "connections_active": 8,
      "connections_max": 20
    },
    "redis": {
      "status": "healthy",
      "response_time_ms": 3,
      "memory_usage": "245MB",
      "hit_rate": "87.3%"
    }
  },
  "performance": {
    "avg_response_time_ms": 145,
    "requests_per_minute": 67,
    "error_rate_percent": 0.12
  }
}
```

---

## ❌ Códigos de Erro

### Códigos de Status HTTP
| Código | Descrição | Cenários Comuns |
|---------|-----------|-----------------|
| `200` | Sucesso | Operação concluída |
| `201` | Criado | Recurso criado com sucesso |
| `400` | Bad Request | Dados inválidos, parâmetros malformados |
| `401` | Unauthorized | Token ausente ou inválido |
| `403` | Forbidden | Sem permissão para recurso |
| `404` | Not Found | Recurso não encontrado |
| `409` | Conflict | Conflito de dados (ex: nome duplicado) |
| `422` | Unprocessable Entity | Erro de validação de negócio |
| `429` | Too Many Requests | Rate limiting atingido |
| `500` | Internal Server Error | Erro interno do servidor |

### Formato de Resposta de Erro
```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request validation failed",
    "details": {
      "errors": [
        "start_date is required",
        "end_date must be after start_date"
      ]
    },
    "suggestion": "Check the API documentation for required parameters"
  }
}
```

### Códigos de Erro Específicos

#### Autenticação
- `invalid_token` - Token JWT inválido ou expirado
- `insufficient_permissions` - Scopes insuficientes para operação
- `tenant_access_denied` - Sem acesso ao tenant/workspace

#### Validação
- `validation_failed` - Falha na validação de parâmetros
- `invalid_date_range` - Período de datas inválido
- `invalid_funnel_id` - ID do funnel inválido
- `missing_required_field` - Campo obrigatório ausente

#### Negócio
- `funnel_not_found` - Funnel não encontrado
- `funnel_already_archived` - Funnel já arquivado
- `insufficient_data` - Dados insuficientes para análise
- `analysis_failed` - Falha no processamento da análise

#### Rate Limiting
- `rate_limit_exceeded` - Limite de requests excedido
- `quota_exceeded` - Cota de uso excedida

---

## 🚀 Exemplos de Integração

### JavaScript/TypeScript (Frontend)

```typescript
// Configuração do cliente
class MercurioFunnelClient {
  private baseURL = 'http://localhost:3001';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }

    return response.json();
  }

  // Listar funnels
  async getFunnels(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const searchParams = new URLSearchParams(params as any);
    return this.request(`/v1/analytics/funnels?${searchParams}`);
  }

  // Obter análise de conversão
  async getConversionAnalysis(
    funnelId: string, 
    startDate: string, 
    endDate: string,
    options?: {
      includeSegments?: boolean;
      includeTimeseries?: boolean;
      granularity?: 'hourly' | 'daily' | 'weekly';
    }
  ) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      include_segments: String(options?.includeSegments ?? true),
      include_timeseries: String(options?.includeTimeseries ?? true),
      timeseries_granularity: options?.granularity ?? 'daily'
    });

    return this.request(`/v1/analytics/funnels/${funnelId}/conversion?${params}`);
  }

  // Comparar funnels (A/B Testing)
  async compareFunnels(comparisonRequest: {
    funnel_ids: string[];
    comparison_period: {
      start_date: string;
      end_date: string;
    };
    ab_test_configuration?: {
      test_name: string;
      test_hypothesis: string;
      confidence_level: 90 | 95 | 99;
    };
  }) {
    return this.request('/v1/analytics/funnels/compare', {
      method: 'POST',
      body: JSON.stringify(comparisonRequest)
    });
  }

  // Métricas ao vivo
  async getLiveMetrics(funnelId: string, refreshInterval: number = 30) {
    return this.request(
      `/v1/analytics/funnels/${funnelId}/live?refresh_interval=${refreshInterval}`
    );
  }
}

// Exemplo de uso
const client = new MercurioFunnelClient('seu_api_key_aqui');

// Dashboard básico
async function loadDashboard() {
  try {
    // 1. Carregar lista de funnels
    const funnels = await client.getFunnels({ limit: 10 });
    
    // 2. Carregar métricas de conversão para o primeiro funnel
    if (funnels.data.length > 0) {
      const conversionData = await client.getConversionAnalysis(
        funnels.data[0].id,
        '2025-08-01',
        '2025-08-26'
      );
      
      console.log('Conversion Rate:', conversionData.overall_metrics.conversion_rate);
      console.log('Step Metrics:', conversionData.step_metrics);
    }
    
    // 3. Carregar métricas ao vivo
    const liveMetrics = await client.getLiveMetrics(funnels.data[0].id);
    console.log('Active Users:', liveMetrics.live_metrics.current_active_users);
    
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}
```

### Python (Backend Integration)

```python
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional

class MercurioFunnelClient:
    def __init__(self, api_key: str, base_url: str = "http://localhost:3001"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict:
        url = f"{self.base_url}{endpoint}"
        response = self.session.request(method, url, **kwargs)
        
        if not response.ok:
            error_data = response.json()
            raise Exception(f"API Error: {error_data['error']['message']}")
        
        return response.json()
    
    def get_funnels(self, page: int = 1, limit: int = 20, search: str = None) -> Dict:
        """Listar funnels"""
        params = {'page': page, 'limit': limit}
        if search:
            params['search'] = search
        
        return self._request('GET', '/v1/analytics/funnels', params=params)
    
    def get_conversion_analysis(self, 
                              funnel_id: str, 
                              start_date: str, 
                              end_date: str,
                              include_segments: bool = True) -> Dict:
        """Obter análise de conversão"""
        params = {
            'start_date': start_date,
            'end_date': end_date,
            'include_segments': include_segments
        }
        
        return self._request('GET', f'/v1/analytics/funnels/{funnel_id}/conversion', 
                           params=params)
    
    def get_bottleneck_analysis(self, funnel_id: str) -> Dict:
        """Obter análise de gargalos"""
        return self._request('GET', f'/v1/analytics/funnels/{funnel_id}/bottlenecks')
    
    def compare_funnels(self, comparison_data: Dict) -> Dict:
        """Comparar funnels (A/B Testing)"""
        return self._request('POST', '/v1/analytics/funnels/compare', 
                           json=comparison_data)

# Exemplo de uso
def generate_weekly_report():
    client = MercurioFunnelClient('seu_api_key_aqui')
    
    # Período da última semana
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    
    # Obter todos os funnels
    funnels = client.get_funnels(limit=100)
    
    report_data = []
    for funnel in funnels['data']:
        # Análise de conversão
        conversion = client.get_conversion_analysis(
            funnel['id'], start_date, end_date
        )
        
        # Análise de gargalos
        bottlenecks = client.get_bottleneck_analysis(funnel['id'])
        
        report_data.append({
            'funnel_name': funnel['name'],
            'conversion_rate': conversion['overall_metrics']['conversion_rate'],
            'total_conversions': conversion['overall_metrics']['total_conversions'],
            'critical_bottlenecks': len([b for b in bottlenecks['detected_bottlenecks'] 
                                       if b['severity'] == 'critical'])
        })
    
    return report_data
```

### cURL (Testing/Debugging)

```bash
#!/bin/bash
# Script para testar endpoints

API_KEY="seu_api_key_aqui"
BASE_URL="http://localhost:3001"

# 1. Health Check
echo "=== Health Check ==="
curl -s "$BASE_URL/health" | jq '.'

# 2. Listar Funnels
echo -e "\n=== Lista de Funnels ==="
curl -s -H "Authorization: Bearer $API_KEY" \
     "$BASE_URL/v1/analytics/funnels" | jq '.data[0]'

# 3. Análise de Conversão
echo -e "\n=== Análise de Conversão ==="
FUNNEL_ID="123456789"
START_DATE="2025-08-01"
END_DATE="2025-08-26"

curl -s -H "Authorization: Bearer $API_KEY" \
     "$BASE_URL/v1/analytics/funnels/$FUNNEL_ID/conversion?start_date=$START_DATE&end_date=$END_DATE" \
     | jq '.overall_metrics'

# 4. Métricas ao Vivo
echo -e "\n=== Métricas ao Vivo ==="
curl -s -H "Authorization: Bearer $API_KEY" \
     "$BASE_URL/v1/analytics/funnels/$FUNNEL_ID/live" \
     | jq '.live_metrics'

# 5. Export de Dados
echo -e "\n=== Export de Dados ==="
curl -s -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -X POST \
     -d '{
       "format": "csv",
       "export_type": "detailed",
       "delivery_method": "download",
       "title": "Relatório Semanal",
       "filters": {
         "start_date": "2025-08-01",
         "end_date": "2025-08-26",
         "include_cohorts": true,
         "include_attribution": true
       }
     }' \
     "$BASE_URL/v1/analytics/funnels/$FUNNEL_ID/export" \
     | jq '.export_id'

# 6. Status do Export
echo -e "\n=== Status do Export ==="
EXPORT_ID="exp_1a2b3c4d5e6f7g8h"
curl -s -H "Authorization: Bearer $API_KEY" \
     "$BASE_URL/v1/analytics/exports/$EXPORT_ID/status" \
     | jq '{status, progress_percent, download_url}'

# 7. Comparação A/B
echo -e "\n=== Comparação A/B ==="
curl -s -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -X POST \
     -d '{
       "funnel_ids": ["123456789", "987654321"],
       "comparison_period": {
         "start_date": "2025-08-01",
         "end_date": "2025-08-26"
       },
       "ab_test_configuration": {
         "test_name": "Form Optimization Test",
         "test_hypothesis": "New form increases conversion by 10%",
         "confidence_level": 95
       }
     }' \
     "$BASE_URL/v1/analytics/funnels/compare" \
     | jq '.ab_test_results.statistical_results'
```

---

Esta documentação completa fornece todas as informações necessárias para integração com os **18 endpoints implementados** da API de Funnel Analytics. Todos os exemplos incluem:

✅ **Campos obrigatórios e opcionais**  
✅ **Formatos de request e response**  
✅ **Códigos de status e tratamento de erros**  
✅ **Exemplos práticos em múltiplas linguagens**  
✅ **Casos de uso reais para dashboard**  
✅ **Funcionalidades de export em CSV, JSON e Excel**  
✅ **Sistema completo de monitoramento de exports**  

---

## 📊 **Resumo dos Endpoints Disponíveis**

### **Configuração de Funnels (5 endpoints)**
- `POST /v1/analytics/funnels` - Criar funnel
- `GET /v1/analytics/funnels` - Listar funnels  
- `GET /v1/analytics/funnels/:id` - Obter funnel
- `PATCH /v1/analytics/funnels/:id` - Atualizar funnel
- `DELETE /v1/analytics/funnels/:id` - Arquivar funnel

### **Analytics Core (4 endpoints)**
- `GET /v1/analytics/funnels/:id/conversion` - Análise de conversão
- `GET /v1/analytics/funnels/:id/dropoff` - Análise de drop-off
- `GET /v1/analytics/funnels/:id/cohorts` - Análise de coortes
- `GET /v1/analytics/funnels/:id/timing` - Análise temporal

### **Analytics Avançados (3 endpoints)**
- `GET /v1/analytics/funnels/:id/bottlenecks` - Detecção de gargalos
- `GET /v1/analytics/funnels/:id/paths` - Análise de caminhos
- `GET /v1/analytics/funnels/:id/attribution` - Análise de atribuição

### **Real-time (2 endpoints)**
- `GET /v1/analytics/funnels/:id/live` - Métricas ao vivo
- `GET /v1/analytics/funnels/:id/users/:userId` - Progressão individual

### **A/B Testing (1 endpoint)**
- `POST /v1/analytics/funnels/compare` - Comparação estatística

### **Export & Integração (2 endpoints)**
- `POST /v1/analytics/funnels/:id/export` - Criar export de dados
- `GET /v1/analytics/exports/:exportId/status` - Status do export

### **Monitoramento (1 endpoint)**
- `GET /health` - Status da API

**Total: 18 endpoints funcionais** prontos para produção! 🚀

A API está pronta para integração frontend! 🚀