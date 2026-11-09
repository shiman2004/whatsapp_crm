import React from 'react';
import { FlatpickrBase, BasePickerProps } from './FlatpickrBase';

export interface AppTimePickerProps extends BasePickerProps {}

/**
 * Global CRM Flatpickr Time Picker
 * Default Format: "H:i" (24-hour time)
 */
export const AppTimePicker: React.FC<AppTimePickerProps> = (props) => {
  return <FlatpickrBase {...props} pickerType="time" />;
};
