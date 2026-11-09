import React from 'react';
import { FlatpickrBase, BasePickerProps } from './FlatpickrBase';

export interface AppDatePickerProps extends BasePickerProps {}

/**
 * Global CRM Flatpickr Date Picker
 * Default Format: "Y-m-d"
 */
export const AppDatePicker: React.FC<AppDatePickerProps> = (props) => {
  return <FlatpickrBase {...props} pickerType="date" />;
};
