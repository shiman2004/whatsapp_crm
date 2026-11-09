import React from 'react';
import { FlatpickrBase, BasePickerProps } from './FlatpickrBase';

export interface AppDateRangePickerProps extends BasePickerProps {}

/**
 * Global CRM Flatpickr Date Range Picker
 * Default Format: "Y-m-d to Y-m-d"
 */
export const AppDateRangePicker: React.FC<AppDateRangePickerProps> = (props) => {
  return <FlatpickrBase {...props} pickerType="range" />;
};
