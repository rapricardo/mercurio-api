export class TimezoneUtils {
  private static readonly VALID_TIMEZONES = [
    'UTC',
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
  ];

  static isValidTimezone(timezone: string): boolean {
    if (this.VALID_TIMEZONES.includes(timezone)) {
      return true;
    }

    try {
      // Test if it's a valid timezone by creating a date
      Intl.DateTimeFormat('en', { timeZone: timezone }).format(new Date());
      return true;
    } catch {
      return false;
    }
  }

  static convertToTimezone(date: Date, timezone: string): Date {
    if (!this.isValidTimezone(timezone)) {
      throw new Error(`Invalid timezone: ${timezone}`);
    }

    if (timezone === 'UTC') {
      return date;
    }

    try {
      // Get the UTC offset for the timezone
      const utcTime = date.getTime();
      const tempDate = new Date(utcTime);
      
      // Create formatter for the target timezone
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      const parts = formatter.formatToParts(tempDate);
      const formatted = parts.reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
      }, {} as Record<string, string>);

      // Reconstruct date string and parse
      const dateString = `${formatted.year}-${formatted.month}-${formatted.day}T${formatted.hour}:${formatted.minute}:${formatted.second}`;
      return new Date(dateString + 'Z'); // Treat as UTC since we already converted

    } catch (error) {
      throw new Error(`Failed to convert timezone: ${error}`);
    }
  }

  static getTimezoneOffset(timezone: string, date: Date = new Date()): number {
    if (!this.isValidTimezone(timezone)) {
      throw new Error(`Invalid timezone: ${timezone}`);
    }

    if (timezone === 'UTC') {
      return 0;
    }

    try {
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      
      return (localDate.getTime() - utcDate.getTime()) / (1000 * 60); // Return offset in minutes
    } catch (error) {
      throw new Error(`Failed to get timezone offset: ${error}`);
    }
  }

  static formatDateInTimezone(
    date: Date, 
    timezone: string, 
    format: 'ISO' | 'short' | 'long' = 'ISO'
  ): string {
    if (!this.isValidTimezone(timezone)) {
      throw new Error(`Invalid timezone: ${timezone}`);
    }

    try {
      switch (format) {
        case 'ISO':
          if (timezone === 'UTC') {
            return date.toISOString();
          } else {
            const converted = this.convertToTimezone(date, timezone);
            return converted.toISOString();
          }
        case 'short':
          return date.toLocaleDateString('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        case 'long':
          return date.toLocaleDateString('en-US', {
            timeZone: timezone,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
        default:
          return date.toISOString();
      }
    } catch (error) {
      throw new Error(`Failed to format date in timezone: ${error}`);
    }
  }

  static getTruncatedDate(
    date: Date,
    granularity: 'hour' | 'day' | 'week',
    timezone: string = 'UTC'
  ): Date {
    if (!this.isValidTimezone(timezone)) {
      throw new Error(`Invalid timezone: ${timezone}`);
    }

    try {
      let truncatedDate: Date;

      if (timezone === 'UTC') {
        truncatedDate = new Date(date);
      } else {
        truncatedDate = this.convertToTimezone(date, timezone);
      }

      switch (granularity) {
        case 'hour':
          truncatedDate.setMinutes(0, 0, 0);
          break;
        case 'day':
          truncatedDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          const dayOfWeek = truncatedDate.getDay();
          const startOfWeek = new Date(truncatedDate);
          startOfWeek.setDate(truncatedDate.getDate() - dayOfWeek);
          startOfWeek.setHours(0, 0, 0, 0);
          truncatedDate = startOfWeek;
          break;
      }

      return truncatedDate;
    } catch (error) {
      throw new Error(`Failed to truncate date: ${error}`);
    }
  }
}