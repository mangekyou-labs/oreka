import { format, formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Chuyển đổi timestamp UTC thành thời gian ở múi giờ được chỉ định
export const formatUTCToZonedTime = (
  timestamp: number, 
  formatStr: string = 'MMM d, yyyy h:mm a',
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone // Mặc định là múi giờ của người dùng
): string => {
  if (!timestamp) return 'TBD';
  const date = new Date(timestamp * 1000);
  const zonedDate = toZonedTime(date, timeZone);
  return format(zonedDate, formatStr) + ` (${getTimeZoneAbbr(timeZone)})`;
};

// Tính thời gian còn lại từ thời điểm hiện tại đến timestamp đích
export const calculateTimeRemaining = (targetTimestamp: number): string => {
  if (!targetTimestamp) return '';
  const now = new Date();
  const targetDate = new Date(targetTimestamp * 1000);
  
  if (targetDate <= now) return 'Đã hết hạn';
  return formatDistanceToNow(targetDate, { addSuffix: true });
};

// Lấy viết tắt múi giờ (ET, UTC, v.v.)
export const getTimeZoneAbbr = (timeZone: string): string => {
  const mapping: Record<string, string> = {
    'America/New_York': 'ET',
    'America/Chicago': 'CT',
    'America/Denver': 'MT',
    'America/Los_Angeles': 'PT',
    'Etc/UTC': 'UTC',
    'Europe/London': 'GMT'
  };
  
  // Mặc định hiển thị múi giờ ngắn gọn
  if (mapping[timeZone]) return mapping[timeZone];
  
  // Nếu không tìm thấy trong mapping, tạo viết tắt dựa trên offset
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone,
    timeZoneName: 'short'
  });
  const parts = formatter.formatToParts(now);
  const tzPart = parts.find(part => part.type === 'timeZoneName');
  return tzPart ? tzPart.value : 'Local';
};

// Chuyển đổi thời gian sang Unix timestamp (giây)
export const toUnixTimestamp = (date: Date): number => {
  return Math.floor(date.getTime() / 1000);
};

// Lấy thời gian hiện tại dưới dạng Unix timestamp (giây)
export const getCurrentUnixTimestamp = (): number => {
  return Math.floor(Date.now() / 1000);
};

export const formatTimeRemaining = (timestamp: number): string => {
  if (!timestamp) return '';
  const now = new Date();
  const targetDate = new Date(timestamp * 1000);
  
  if (targetDate <= now) return 'Expired';
  return formatDistanceToNow(targetDate, { addSuffix: true });
};

/**
 * Chuyển đổi ngày và giờ thành timestamp (Unix epoch) sử dụng múi giờ của trình duyệt
 * @param date - Ngày ở định dạng YYYY-MM-DD
 * @param time - Thời gian ở định dạng HH:MM
 * @returns Timestamp tính bằng giây
 */
export const createMaturityTimestamp = (date: string, time: string): number => {
  if (!date || !time) return 0;

  const [hours, minutes] = time.split(':').map(Number);
  const dateObj = new Date(`${date}T00:00:00`);
  dateObj.setHours(hours, minutes, 0, 0);
  
  return Math.floor(dateObj.getTime() / 1000);
};

/**
 * Định dạng timestamp thành chuỗi ngày giờ theo định dạng cụ thể
 * Sử dụng múi giờ của trình duyệt
 * @param timestamp - Timestamp tính bằng giây
 * @param formatString - Định dạng output (mặc định: 'MMM d, yyyy h:mm a')
 * @returns Chuỗi ngày giờ đã định dạng
 */
export const formatTimeToLocal = (timestamp: number, formatString: string = 'MMM d, yyyy h:mm a'): string => {
  if (!timestamp) return 'Not set';
  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'Invalid date';
  }
};

/**
 * Tính thời gian còn lại đến một timestamp
 * @param targetTimestamp - Timestamp đích tính bằng giây
 * @returns Chuỗi thời gian còn lại
 */
export const getTimeRemaining = (targetTimestamp: number): string => {
  if (!targetTimestamp) return 'Unknown';
  
  const now = Math.floor(Date.now() / 1000);
  const remainingSeconds = targetTimestamp - now;
  
  if (remainingSeconds <= 0) return 'Expired';
  
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = Math.floor(remainingSeconds % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  
  return `${minutes}m ${seconds}s`;
};

/**
 * Chuyển đổi timestamp thành đối tượng Date
 * @param timestamp - Timestamp tính bằng giây
 * @returns Đối tượng Date
 */
export const timestampToDate = (timestamp: number): Date => {
  return new Date(timestamp * 1000);
};

/**
 * Lấy timestamp hiện tại (tính bằng giây)
 * @returns Timestamp hiện tại
 */
export const getCurrentTimestamp = (): number => {
  return Math.floor(Date.now() / 1000);
};

/**
 * Kiểm tra xem một timestamp đã qua hay chưa
 * @param timestamp - Timestamp cần kiểm tra (tính bằng giây)
 * @returns true nếu timestamp đã qua, false nếu chưa
 */
export const isTimestampPassed = (timestamp: number): boolean => {
  return getCurrentTimestamp() >= timestamp;
}; 