// src/components/summary/SummaryTable.jsx
import React from 'react';
import { Row, Col, Typography } from 'antd'; // ✅ List 제거
import { FIELD_ORDER, FIELD_LABELS } from '../../config/templateSummaryConfig';

const { Text, Title } = Typography;

// 🔹 배열 형태 데이터를 표로 그려주는 NestedTable
const NestedTable = ({ data, primaryText, secondaryText, borderColor }) => {
  if (!data || data.length === 0) return null;

  const headers = Object.keys(data[0]);

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    color: primaryText,
    fontSize: '14px',
  };
  const cellStyle = {
    border: `1px solid ${borderColor}`,
    padding: '10px 12px',
    textAlign: 'left',
  };
  const headerStyle = {
    ...cellStyle,
    backgroundColor: '#383838',
    color: primaryText,
    fontWeight: '600',
  };
  const bodyRowStyle = {
    backgroundColor: 'transparent',
  };

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} style={headerStyle}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex} style={bodyRowStyle}>
            {headers.map((header) => (
              <td key={`${rowIndex}-${header}`} style={cellStyle}>
                {row[header] ?? (
                  <Text type="secondary" style={{ color: secondaryText }}>
                    -
                  </Text>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// 🔹 템플릿별 필드 한글 라벨 + 출력 순서 적용한 SummaryTable
function SummaryTable({
  summaryJson,
  templateId = 'TPL1',
  primaryText = '#f0f0f0',
  secondaryText = '#a0a0a0',
  borderColor = '#303030',
  accentColor = '#4a90e2',
}) {
  if (!summaryJson || Object.keys(summaryJson).length === 0) {
    return <Text style={{ color: secondaryText }}>AI 요약 데이터가 없습니다.</Text>;
  }

  const tplId = (templateId || 'TPL1').toUpperCase();

  // ⚙️ 1) 출력 순서 가져오기 (없으면 summaryJson의 key 순서 사용)
  const order = FIELD_ORDER[tplId] || Object.keys(summaryJson);

  // ⚙️ 2) 한글 라벨 맵
  const labelMap = FIELD_LABELS[tplId] || {};

  // ⚙️ 3) 순서대로 돌면서 렌더링용 데이터 만들기
  const dataList = order
    .map((key) => {
      const value = summaryJson[key];

      if (value === undefined || value === null || value === '') return null;

      let displayValue;
      let isTable = false;

      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        // 배열 + 객체 => 표로 렌더링
        isTable = true;
        displayValue = (
          <NestedTable
            data={value}
            primaryText={primaryText}
            secondaryText={secondaryText}
            borderColor={borderColor}
          />
        );
      } else if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) {
        // 중첩 객체 => "키: 값, 키: 값" 형식으로
        displayValue = Object.entries(value)
          .map(([subKey, subValue]) => `${subKey}: ${subValue}`)
          .join(', ');
      } else {
        // 그냥 문자열/숫자
        displayValue = value;
      }

      return {
        key,
        label: labelMap[key] || key,
        displayValue,
        isTable,
      };
    })
    .filter(Boolean);

  return (
    <div
      style={{
        backgroundColor: 'transparent',
        color: primaryText,
        fontSize: '15px',
      }}
    >
      {dataList.map((item) => (
        <div
          key={item.key}
          style={{
            borderBottom: `1px solid ${borderColor}`,
            padding: item.isTable ? '20px 0' : '12px 0',
          }}
        >
          <Row style={{ width: '100%' }} align="top">
            <Col
              span={item.isTable ? 24 : 6}
              style={{
                fontWeight: '600',
                color: accentColor,
                marginBottom: item.isTable ? '15px' : '0',
              }}
            >
              {item.isTable ? (
                <Title level={5} style={{ color: primaryText, margin: 0 }}>
                  {item.label}
                </Title>
              ) : (
                item.label
              )}
            </Col>
            <Col
              span={item.isTable ? 24 : 18}
              style={{ color: primaryText, whiteSpace: 'pre-wrap' }}
            >
              {item.displayValue ?? (
                <Text type="secondary" style={{ color: secondaryText }}>
                  -
                </Text>
              )}
            </Col>
          </Row>
        </div>
      ))}
    </div>
  );
}

export default SummaryTable;
