import React from 'react';
import Step2Packages from '@/modules/wizard/Steps/Step2Packages';

interface Step2Props {
  data: {
    services: any;
    applicants?: any[];
  };
  updateData: (field: string, value: any) => void;
}

export default function Step2Services({ data, updateData }: Step2Props) {
  return (
    <Step2Packages
      portalType="INDIVIDUAL"
      services={data.services}
      applicantsCount={data.applicants?.length || 1}
      updateData={updateData}
    />
  );
}
