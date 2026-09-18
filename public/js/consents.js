/*
 * Consent documents — single source of truth, used by the web page AND the PDF builder.
 * Wording is transcribed from the company's original PDFs:
 *   - "BACKGROUND CHECK CONSENT FORM.pdf"
 *   - "PSP CONSENT FORM.pdf"  (FMCSA-mandated language: must be used exactly as provided)
 * Do not reword the text below.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RSConsents = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const COMPANY = {
    caps: 'RIGHTEOUS AND SON INC',
    name: 'Righteous and Son Inc',
    address1: '902 Britton St',
    address2: 'Largo, FL 33770',
  };

  const NAME = { name: true }; // placeholder replaced by the applicant's typed name
  const b = (t) => ({ t, b: true });
  const i = (t) => ({ t, i: true });
  const p = (...runs) => ({ kind: 'p', runs: runs.map((r) => (typeof r === 'string' ? { t: r } : r)) });

  const BACKGROUND_CHECK = {
    id: 'background',
    title: 'Background Check',
    blocks: [
      p(
        'I, ', NAME, ' hereby authorize ', b('RIGHTEOUS AND SON INC'),
        ' and/or its agents to make investigation of my background, references, character, past employment, education, and criminal history record information which may be in any state or local files, including those maintained by both public and private organizations, and all public records, for the purpose of confirming the information contained on my application and/or obtaining other information which may be material to my qualifications for employment. A telephone facsimile (fax) or xerographic copy of this consent shall be considered as valid as the original consent.'
      ),
      p(
        'I hereby consent to the Company’s verification of all the information I have provided on my application form. I also agree to execute as a condition of employment any additional written authorization necessary for the Company to obtain access to and copies of records pertaining to this information. I also hereby authorize the Company’s access to any medical histories or records pertaining to me (and any other individuals who due to my employment may be covered by any Company medical or other insurance program). With regard to the foregoing disclosures, I hereby agree to release any person, company, or other entity from any and all causes of action that otherwise might arise from supplying the Company with information it may request pursuant to this release. I understand any false answers or statements, or misrepresentations by omission, made by me on this application or any related document, will be sufficient for rejection of my application or for my immediate discharge should such falsifications or misrepresentations be discovered after I am employed.'
      ),
    ],
  };

  const PSP = {
    id: 'psp',
    title: 'PSP Disclosure and Authorization',
    banner: 'THE BELOW DISCLOSURE AND AUTHORIZATION LANGUAGE IS FOR MANDATORY USE BY ALL ACCOUNT HOLDERS',
    blocks: [
      { kind: 'center-bold', runs: [{ t: 'IMPORTANT DISCLOSURE' }] },
      { kind: 'center-bold', runs: [{ t: 'REGARDING BACKGROUND REPORTS FROM THE ' }, { t: 'PSP Online Service', i: true }] },
      p('In connection with your application for employment with RIGHTEOUS AND SON, INC., Prospective Employer, its employees, agents or contractors may obtain one or more reports regarding your driving, and safety inspection history from the Federal Motor Carrier Safety Administration (FMCSA).'),
      p('When the application for employment is submitted in person, if the Prospective Employer uses any information it obtains from FMCSA in a decision to not hire you or to make any other adverse employment decision regarding you, the Prospective Employer will provide you with a copy of the report upon which its decision was based and a written summary of your rights under the Fair Credit Reporting Act before taking any final adverse action. If any final adverse action is taken against you based upon your driving history or safety report, the Prospective Employer will notify you that the action has been taken and that the action was based in part or in whole on this report.'),
      p('When the application for employment is submitted by mail, telephone, computer, or other similar means, if the Prospective Employer uses any information it obtains from FMCSA in a decision to not hire you or to make any other adverse employment decision regarding you, the Prospective Employer must provide you within three business days of taking adverse action oral, written or electronic notification: that adverse action has been taken based in whole or in part on information obtained from FMCSA; the name, address, and the toll free telephone number of FMCSA; that the FMCSA did not make the decision to take the adverse action and is unable to provide you the specific reasons why the adverse action was taken; and that you may, upon providing proper identification, request a free copy of the report and may dispute with the FMCSA the accuracy or completeness of any information or report. If you request a copy of a driver record from the Prospective Employer who procured the report, then, within 3 business days of receiving your request, together with proper identification, the Prospective Employer must send or provide to you a copy of your report and a summary of your rights under the Fair Credit Reporting Act.'),
      p('Neither the Prospective Employer nor the FMCSA contractor supplying the crash and safety information has the capability to correct any safety data that appears to be incorrect. You may challenge the accuracy of the data by submitting a request to https://dataqs.fmcsa.dot.gov. If you challenge crash or inspection information reported by a State, FMCSA cannot change or correct this data. Your request will be forwarded by the DataQs system to the appropriate State for adjudication.'),
      p('Any crash or inspection in which you were involved will display on your PSP report. Since the PSP report does not report, or assign, or imply fault, it will include all Commercial Motor Vehicle (CMV) crashes where you were a driver or co-driver and where those crashes were reported to FMCSA, regardless of fault. Similarly, all inspections, with or without violations, appear on the PSP report. State citations associated with Federal Motor Carrier Safety Regulations (FMCSR) violations that have been adjudicated by a court of law will also appear, and remain, on a PSP report.'),
      p('The Prospective Employer cannot obtain background reports from FMCSA without your authorization.'),
      { kind: 'heading', runs: [{ t: 'AUTHORIZATION' }] },
      p('If you agree that the Prospective Employer may obtain such background reports, please read the following and sign below:'),
      p('I authorize RIGHTEOUS AND SON, INC. (“Prospective Employer”) to access the FMCSA Pre-Employment Screening Program (PSP) system to seek information regarding my commercial driving safety record and information regarding my safety inspection history. I understand that I am authorizing the release of safety performance information including crash data from the previous five (5) years and inspection history from the previous three (3) years. I understand and acknowledge that this release of information may assist the Prospective Employer to make a determination regarding my suitability as an employee.'),
      p('I further understand that neither the Prospective Employer nor the FMCSA contractor supplying the crash and safety information has the capability to correct any safety data that appears to be incorrect. I understand I may challenge the accuracy of the data by submitting a request to https://dataqs.fmcsa.dot.gov. If I challenge crash or inspection information reported by a State, FMCSA cannot change or correct this data. I understand my request will be forwarded by the DataQs system to the appropriate State for adjudication.'),
      p('I understand that any crash or inspection in which I was involved will display on my PSP report. Since the PSP report does not report, or assign, or imply fault, I acknowledge it will include all CMV crashes where I was a driver or co-driver and where those crashes were reported to FMCSA, regardless of fault. Similarly, I understand all inspections, with or without violations, will appear on my PSP report, and State citations associated with FMCSR violations that have been adjudicated by a court of law will also appear, and remain, on my PSP report.'),
      p('I have read the above Disclosure Regarding Background Reports provided to me by Prospective Employer and I understand that if I sign this Disclosure and Authorization, Prospective Employer may obtain a report of my crash and inspection history. I hereby authorize Prospective Employer and its employees, authorized agents, and/or affiliates to obtain the information authorized above.'),
    ],
    // Shown after the signature block, as in the original form.
    notices: [
      'NOTICE: This form is made available to monthly account holders by NIC on behalf of the U.S. Department of Transportation, Federal Motor Carrier Safety Administration (FMCSA). Account holders are required by federal law to obtain an Applicant’s written or electronic consent prior to accessing the Applicant’s PSP report. Further, account holders are required by FMCSA to use the language contained in this Disclosure and Authorization form to obtain an Applicant’s consent. The language must be used in whole, exactly as provided. Further, the language on this form must exist as one stand-alone document. The language may NOT be included with other consent forms or any other language.',
      'NOTICE: The prospective employment concept referenced in this form contemplates the definition of “employee” contained at 49 C.F.R. 383.5.',
    ],
  };

  const EEO =
    'In compliance with Federal and State equal employment opportunity laws, qualified applicants are considered for all positions without regard to race, color, religion, sex, national origin, age, marital status, veteran status, non-job related disability, or any other protected group status.';

  const CERTIFICATION = [
    'By signing my application below, I agree to use an electronic signature to demonstrate my consent. An electronic signature is as legally binding as an ink signature.',
    'This certifies that this application was completed by me, and that all entries on it and information in it are true and complete to the best of my knowledge.',
  ];

  const ACKNOWLEDGEMENTS = [
    {
      id: 'ack_psp',
      title: 'PSP Disclosure and Authorization',
      text: 'By checking the box, I (a) acknowledge that I have read and understand the PSP Disclosure and Authorization and also have been given the opportunity to copy/print it, and (b) agree to use an electronic signature to demonstrate my consent. An electronic signature is as legally binding as an ink signature',
    },
    {
      id: 'ack_drug',
      title: 'Employment Verification Acknowledgment and Release (DOT Drug and Alcohol)',
      text: 'By checking the box, I (a) acknowledge that I have read and understand the above and also have been given the opportunity to copy/print it, and (b) agree to use an electronic signature to demonstrate my consent. An electronic signature is as legally binding as an ink signature',
    },
    {
      id: 'ack_zero',
      title: 'Drug and Alcohol Zero Tolerance Policy',
      text: 'By checking the box, I (a) acknowledge that Righteous and Son Inc has a Zero Tolerance Policy for the use, sale, purchase, transfer, possession, or presence in one\u2019s system of alcohol or any controlled substance (except medically prescribed drugs) by any person while engaged in company business, operating company equipment, or while under the authority of Righteous and Son Inc is strictly prohibited.',
    },
    {
      id: 'ack_clearinghouse',
      title: 'Clearinghouse Release',
      text: 'By checking the box, I (a) acknowledge that I have read and understand the above and also have been given the opportunity to copy/print it, and (b) agree to use an electronic signature to demonstrate my consent. An electronic signature is as legally binding as an ink signature.',
    },
  ];

  return { COMPANY, BACKGROUND_CHECK, PSP, EEO, CERTIFICATION, ACKNOWLEDGEMENTS };
});
