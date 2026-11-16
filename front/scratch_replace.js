const fs = require('fs');
const path = 'c:/Users/lenovo/Desktop/EUROTECH/front/src/modules/agent/pages/Groups/AgentGroups.tsx';
let content = fs.readFileSync(path, 'utf8');

const startMarker = '{/* --- TAB 1: APPLICATION FORM --- */}';
const endMarker = '{/* --- TAB 2: DOCUMENTS --- */}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error('Markers not found! startIndex:', startIndex, 'endIndex:', endIndex);
    process.exit(1);
}

const replacement = `{/* --- TAB 1: 37-POINT SCHENGEN FORM --- */}
            {manageTab === 'form' && (
                <div className="fade-in">
                    <SchengenQuestionnaire
                        formData={applicantFormData}
                        onFieldChange={(field, value) => setApplicantFormData(prev => ({ ...prev, [field]: value }))}
                        dossier={activeGroup ? {
                            id: activeGroup.dossierId || activeGroup.id,
                            dossierNumber: activeGroup.code || activeGroup.id,
                            portalType: 'GROUP_AGENT',
                            status: activeGroup.status,
                            currentStep: 1,
                            country: { id: '', code: '', nameEn: activeGroup.destination, nameAz: activeGroup.destination },
                        } : null}
                        onOpenMrzModal={() => {}}
                        onSaveForm={handleSaveForm}
                        isCorporateMode={false}
                    />
                </div>
            )}

            `;

content = content.slice(0, startIndex) + replacement + content.slice(endIndex);
fs.writeFileSync(path, content, 'utf8');
console.log('Successfully replaced Tab 1 in AgentGroups.tsx!');

