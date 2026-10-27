import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Đăng ký toàn bộ các thành phần lõi của Chart.js cho ứng dụng React
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Cấu hình phông chữ & màu mặc định phù hợp theme hệ thống
ChartJS.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
ChartJS.defaults.color = '#64748b';
ChartJS.defaults.responsive = true;
ChartJS.defaults.maintainAspectRatio = false;

export { ChartJS };
