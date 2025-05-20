import { format, formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Converts UTC timestamp to time in specified time zone
export const formatUTCToZonedTime = (
  timestamp: number, 
  formatStr: string = 'MMM d, yyyy h:mm a',
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone // default is user time zone
): string => {
  if (!timestamp) return 'TBD';
  const date = new Date(timestamp * 1000);
  const zonedDate = toZonedTime(date, timeZone);
  return format(zonedDate, formatStr) + ` (${getTimeZoneAbbr(timeZone)})`; 
};

// Calculate the remaining time from the current time to the target timestamp
export const calculateTimeRemaining = (targetTimestamp: number): string => {
  if (!targetTimestamp) return '';
  const now = new Date();
  const targetDate = new Date(targetTimestamp * 1000);
  
  if (targetDate <= now) return 'Đã hết hạn';
  return formatDistanceToNow(targetDate, { addSuffix: true });
};

// Get the time zone abbreviation (ET, UTC, etc.)
export const getTimeZoneAbbr = (timeZone: string): string => {
  const mapping: Record<string, string> = {
    'America/New_York': 'ET',
    'America/Chicago': 'CT',
    'America/Denver': 'MT',
    'America/Los_Angeles': 'PT',
    'Etc/UTC': 'UTC',
    'Europe/London': 'GMT'
  };
  
  // Defaults to concise time zone display
  if (mapping[timeZone]) return mapping[timeZone];
  
  // If not found in mapping, create abbreviation based on offset
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone,
    timeZoneName: 'short'
  });
  const parts = formatter.formatToParts(now);
  const tzPart = parts.find(part => part.type === 'timeZoneName');
  return tzPart ? tzPart.value : 'Local';
};

// Convert time to Unix timestamp (seconds)
export const toUnixTimestamp = (date: Date): number => {
  return Math.floor(date.getTime() / 1000);
};

// Get the current time as Unix timestamp (seconds)
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
* Converts date and time to timestamp (Unix epoch) using browser timezone
* @param date - Date in YYYY-MM-DD format
* @param time - Time in HH:MM format
* @returns Timestamp in seconds
*/
export const createMaturityTimestamp = (date: string, time: string): number => {
  if (!date || !time) return 0;

  const [hours, minutes] = time.split(':').map(Number);
  const dateObj = new Date(`${date}T00:00:00`);
  dateObj.setHours(hours, minutes, 0, 0);
  
  return Math.floor(dateObj.getTime() / 1000);
};

/**
* Formats timestamp to datetime string in specific format
* Uses browser timezone
* @param timestamp - Timestamp in seconds
* @param formatString - Output format (default: 'MMM d, yyyy h:mm a')
* @returns Formatted datetime string
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
* Calculates the time remaining to a timestamp
* @param targetTimestamp - Target timestamp in seconds
* @returns String of remaining time
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
* Convert timestamp to Date object
* @param timestamp - Timestamp in seconds
* @returns Date object
*/
export const timestampToDate = (timestamp: number): Date => {
  return new Date(timestamp * 1000);
};

/**
* Get the current timestamp (in seconds)
* @returns Current Timestamp
*/
export const getCurrentTimestamp = (): number => {
  return Math.floor(Date.now() / 1000);
};

/**
* Check if a timestamp has passed
* @param timestamp - Timestamp to check (in seconds)
* @returns true if timestamp has passed, false if not
*/
export const isTimestampPassed = (timestamp: number): boolean => {
  return getCurrentTimestamp() >= timestamp;
}; 