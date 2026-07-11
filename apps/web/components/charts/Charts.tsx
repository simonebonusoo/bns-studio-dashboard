import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { formatCurrency } from '@/lib/format';

const AXIS = { stroke: 'rgb(var(--fg-subtle))', fontSize: 11 };
const GRID = 'rgb(var(--border))';

const tooltipStyle = {
  backgroundColor: 'rgb(var(--surface))',
  border: '1px solid rgb(var(--border))',
  borderRadius: 10,
  fontSize: 12,
  color: 'rgb(var(--fg))',
};

const legendProps = {
  verticalAlign: 'bottom' as const,
  align: 'left' as const,
  iconSize: 10,
  wrapperStyle: {
    fontSize: 12,
    paddingTop: 12,
    lineHeight: '18px',
  },
};

function xTickFormatter(value: string | number) {
  const label = String(value);
  return label.length > 10 ? `${label.slice(0, 10)}…` : label;
}

export function TrendChart({
  data,
  series,
  currency,
}: {
  data: Array<Record<string, string | number>>;
  series: { key: string; color: string; label: string }[];
  currency?: boolean;
}) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <defs>
            {series.map((item) => (
              <linearGradient key={item.key} id={`grad-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={item.color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={item.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickFormatter={xTickFormatter} axisLine={false} tickLine={false} minTickGap={18} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={56} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => (currency ? formatCurrency(value) : value)} />
          <Legend {...legendProps} />
          {series.map((item) => (
            <Area
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={item.color}
              strokeWidth={2}
              fill={`url(#grad-${item.key})`}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineTrend({
  data,
  dataKey,
  color,
}: {
  data: Array<Record<string, string | number>>;
  dataKey: string;
  color: string;
}) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickFormatter={xTickFormatter} axisLine={false} tickLine={false} minTickGap={18} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({
  data,
  currency,
}: {
  data: { name: string; value: number; color: string }[];
  currency?: boolean;
}) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={54}
            outerRadius={88}
            paddingAngle={2}
            isAnimationActive={false}
            stroke="none"
          >
            {data.map((item, index) => (
              <Cell key={index} fill={item.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => (currency ? formatCurrency(value) : value)} />
          <Legend {...legendProps} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GroupedBarChart({
  data,
  series,
  currency,
}: {
  data: Array<Record<string, string | number>>;
  series: { key: string; color: string; label: string }[];
  currency?: boolean;
}) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }} barGap={6}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickFormatter={xTickFormatter} axisLine={false} tickLine={false} interval={0} minTickGap={18} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={52} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => (currency ? formatCurrency(value) : value)} cursor={{ fill: 'rgb(var(--surface-2))' }} />
          <Legend {...legendProps} />
          {series.map((item) => (
            <Bar key={item.key} dataKey={item.key} name={item.label} fill={item.color} radius={[4, 4, 0, 0]} barSize={18} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HBarChart({
  data,
  color,
  currency,
}: {
  data: { name: string; value: number }[];
  color: string;
  currency?: boolean;
}) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={AXIS} tickFormatter={xTickFormatter} axisLine={false} tickLine={false} width={130} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => (currency ? formatCurrency(value) : value)} cursor={{ fill: 'rgb(var(--surface-2))' }} />
          <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
