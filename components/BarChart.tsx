
import React from 'react';

interface ChartData {
  label: string;
  value: number;
  color: string;
}

interface BarChartProps {
  data: ChartData[];
  title: string;
}

const BarChart: React.FC<BarChartProps> = ({ data, title }) => {
  const maxValue = Math.max(...data.map(item => item.value));

  return (
    <div className="w-full">
      <h3 className="text-lg md:text-2xl font-black text-center mb-6 md:mb-10 uppercase tracking-tighter leading-tight">
        {title}
      </h3>
      
      <div className="flex justify-around items-end h-56 md:h-80 space-x-2 md:space-x-8 border-l-2 md:border-l-4 border-b-2 md:border-b-4 border-black pl-2 md:pl-6 pb-1 relative">
        {/* Y-Axis Label */}
        <div className="absolute -left-1 md:-left-12 top-0 bottom-0 flex flex-col justify-between text-[7px] md:text-[10px] font-mono text-gray-400 uppercase py-1 pointer-events-none">
            <span>{maxValue >= 1000000 ? `${(maxValue/1000000).toFixed(1)}M` : maxValue.toLocaleString()}€</span>
            <span>{(maxValue/2) >= 1000000 ? `${(maxValue/2000000).toFixed(1)}M` : (maxValue/2).toLocaleString()}€</span>
            <span>0€</span>
        </div>

        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center justify-end group relative h-full">
            {/* Bar */}
            <div 
              className="w-full transition-all duration-1000 ease-out border-t-2 md:border-t-3 border-x-2 md:border-x-3 border-black shadow-hard-sm group-hover:shadow-none group-hover:translate-x-[1px] group-hover:translate-y-[1px] relative"
              style={{ 
                height: `${(item.value / maxValue) * 100}%`,
                backgroundColor: item.color
              }}
            >
              {/* Value Label on Top (Mobile optimized) */}
              <div className="absolute -top-5 md:-top-7 left-1/2 -translate-x-1/2 text-[8px] md:text-xs font-mono font-bold whitespace-nowrap bg-white/80 md:bg-transparent px-1">
                {item.value >= 1000000 ? `${(item.value/1000000).toFixed(1)}M€` : `${item.value.toLocaleString()}€`}
              </div>

              {/* Tooltip Desktop */}
              <div className="hidden md:group-hover:block absolute -top-12 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-mono font-bold py-1 px-2 z-20 whitespace-nowrap border border-white shadow-xl">
                VALEUR EXACTE: {item.value.toLocaleString('fr-FR')}€
              </div>
            </div>

            {/* Label Bottom */}
            <div className="w-full h-12 md:h-16 flex items-start justify-center pt-2">
                <span className="text-[8px] md:text-[11px] font-black uppercase text-center tracking-tighter leading-[1.1] md:leading-none transform md:rotate-0 -rotate-12 origin-top">
                    {item.label}
                </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BarChart;
