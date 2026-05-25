import React from 'react';

interface MQTScore {
  name: string;
  rawScore: number;
  stanine?: number;
}

interface Career {
  career_id: number;
  title: string;
  description?: string;
}

interface SuggestionResult {
  greenPathways: Career[];
  orangePathways: Career[];
  redPathways: Career[];
  topPersonalityTraits: MQTScore[];
  topIntelligenceTypes: MQTScore[];
  topAbilities: MQTScore[];
}

interface ComparisonResult {
  programResult: SuggestionResult;
  llmResult: SuggestionResult;
  agreements: string[];
  disagreements: string[];
}

interface Props {
  data: ComparisonResult;
}

const CareerColumn: React.FC<{ result: SuggestionResult }> = ({ result }) => (
  <div className='d-flex flex-column gap-4'>
    {/* Green */}
    <div className='card border-success'>
      <div className='card-header bg-success text-white py-3'>
        <h6 className='mb-0'>🟢 Most Suited (Green)</h6>
      </div>
      <div className='card-body p-3'>
        {result.greenPathways?.length ? (
          result.greenPathways.map((c, i) => (
            <div key={c.career_id} className='d-flex align-items-center mb-2'>
              <span className='badge badge-light-success me-2'>{i + 1}</span>
              <span className='fw-semibold'>{c.title}</span>
            </div>
          ))
        ) : (
          <span className='text-muted'>No data</span>
        )}
      </div>
    </div>

    {/* Orange */}
    <div className='card border-warning'>
      <div className='card-header bg-warning text-dark py-3'>
        <h6 className='mb-0'>🟠 Moderate (Orange)</h6>
      </div>
      <div className='card-body p-3'>
        {result.orangePathways?.length ? (
          result.orangePathways.map((c, i) => (
            <div key={c.career_id} className='d-flex align-items-center mb-2'>
              <span className='badge badge-light-warning me-2'>{i + 1}</span>
              <span className='fw-semibold'>{c.title}</span>
            </div>
          ))
        ) : (
          <span className='text-muted'>No data</span>
        )}
      </div>
    </div>

    {/* Red */}
    <div className='card border-danger'>
      <div className='card-header bg-danger text-white py-3'>
        <h6 className='mb-0'>🔴 Least Suited (Red)</h6>
      </div>
      <div className='card-body p-3'>
        {result.redPathways?.length ? (
          result.redPathways.map((c, i) => (
            <div key={c.career_id} className='d-flex align-items-center mb-2'>
              <span className='badge badge-light-danger me-2'>{i + 1}</span>
              <span className='fw-semibold'>{c.title}</span>
            </div>
          ))
        ) : (
          <span className='text-muted'>No data</span>
        )}
      </div>
    </div>

    {/* Top Traits (program only) */}
    {result.topPersonalityTraits?.length > 0 && (
      <div className='card'>
        <div className='card-header py-3'>
          <h6 className='mb-0'>Top Personality Traits</h6>
        </div>
        <div className='card-body p-3'>
          {result.topPersonalityTraits.map((t) => (
            <div key={t.name} className='d-flex justify-content-between mb-1'>
              <span>{t.name}</span>
              <span className='text-muted'>
                Raw: {t.rawScore}
                {t.stanine !== undefined && t.stanine !== null ? ` | Stanine: ${t.stanine}` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

const ComparisonView: React.FC<Props> = ({ data }) => {
  return (
    <div>
      {/* Side-by-side columns */}
      <div className='row g-4 mb-6'>
        <div className='col-md-6'>
          <div className='card card-flush shadow-sm'>
            <div className='card-header bg-primary text-white py-4'>
              <h5 className='mb-0'>Rule-Based Program</h5>
            </div>
            <div className='card-body'>
              <CareerColumn result={data.programResult} />
            </div>
          </div>
        </div>
        <div className='col-md-6'>
          <div className='card card-flush shadow-sm'>
            <div className='card-header bg-info text-white py-4'>
              <h5 className='mb-0'>Qwen3 LLM</h5>
            </div>
            <div className='card-body'>
              <CareerColumn result={data.llmResult} />
            </div>
          </div>
        </div>
      </div>

      {/* Agreements & Disagreements */}
      <div className='row g-4'>
        <div className='col-md-6'>
          <div className='card border-success'>
            <div className='card-header bg-light-success py-3'>
              <h6 className='mb-0 text-success'>✅ Agreements ({data.agreements?.length || 0})</h6>
            </div>
            <div className='card-body p-3'>
              {data.agreements?.length ? (
                data.agreements.map((a) => (
                  <span key={a} className='badge badge-light-success me-2 mb-2'>{a}</span>
                ))
              ) : (
                <span className='text-muted'>No agreements</span>
              )}
            </div>
          </div>
        </div>
        <div className='col-md-6'>
          <div className='card border-danger'>
            <div className='card-header bg-light-danger py-3'>
              <h6 className='mb-0 text-danger'>❌ Disagreements ({data.disagreements?.length || 0})</h6>
            </div>
            <div className='card-body p-3'>
              {data.disagreements?.length ? (
                data.disagreements.map((d) => (
                  <span key={d} className='badge badge-light-danger me-2 mb-2'>{d}</span>
                ))
              ) : (
                <span className='text-muted'>No disagreements</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonView;
