import React from 'react';
import { FlatpickrBase, BasePickerProps } from './FlatpickrBase';

export interface AppDateTimePickerProps extends BasePickerProps {}

/**
 * Global CRM Flatpickr Date & Time Picker
 * Default Format: "Y-m-d H:i" (24-hour time)
 */
export const AppDateTimePicker: React.FC<AppDateTimePickerProps> = (props) => {
  return <FlatpickrBase {...props} pickerType="datetime" />;
};
