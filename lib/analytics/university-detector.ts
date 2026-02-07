// Common university email domains
const UNIVERSITY_DOMAINS: Record<string, string> = {
  // US Universities
  'stanford.edu': 'Stanford University',
  'mit.edu': 'MIT',
  'harvard.edu': 'Harvard University',
  'yale.edu': 'Yale University',
  'princeton.edu': 'Princeton University',
  'columbia.edu': 'Columbia University',
  'cornell.edu': 'Cornell University',
  'upenn.edu': 'University of Pennsylvania',
  'uchicago.edu': 'University of Chicago',
  'caltech.edu': 'Caltech',
  'berkeley.edu': 'UC Berkeley',
  'ucla.edu': 'UCLA',
  'umich.edu': 'University of Michigan',
  'nyu.edu': 'NYU',
  'usc.edu': 'USC',
  'northwestern.edu': 'Northwestern University',
  'duke.edu': 'Duke University',
  'jhu.edu': 'Johns Hopkins University',
  'cmu.edu': 'Carnegie Mellon University',
  'gatech.edu': 'Georgia Tech',
  'utexas.edu': 'UT Austin',
  'uiuc.edu': 'University of Illinois',
  'wisc.edu': 'University of Wisconsin',
  'psu.edu': 'Penn State',
  'osu.edu': 'Ohio State University',
  'tamu.edu': 'Texas A&M',
  'ucsd.edu': 'UC San Diego',
  'ucsb.edu': 'UC Santa Barbara',
  'ucdavis.edu': 'UC Davis',
  'ucirvine.edu': 'UC Irvine',
  'ucsc.edu': 'UC Santa Cruz',
  'ucr.edu': 'UC Riverside',
  'ucmerced.edu': 'UC Merced',
  'virginia.edu': 'University of Virginia',
  'unc.edu': 'UNC Chapel Hill',
  'vanderbilt.edu': 'Vanderbilt University',
  'rice.edu': 'Rice University',
  'wustl.edu': 'Washington University in St. Louis',
  'emory.edu': 'Emory University',
  'georgetown.edu': 'Georgetown University',
  'notre Dame.edu': 'Notre Dame',
  'tufts.edu': 'Tufts University',
  'bu.edu': 'Boston University',
  'northeastern.edu': 'Northeastern University',
  'bc.edu': 'Boston College',
  'brandeis.edu': 'Brandeis University',
  'brown.edu': 'Brown University',
  'dartmouth.edu': 'Dartmouth College',
  'williams.edu': 'Williams College',
  'amherst.edu': 'Amherst College',
  'swarthmore.edu': 'Swarthmore College',
  'wellesley.edu': 'Wellesley College',
  'pomona.edu': 'Pomona College',
  
  // International
  'ox.ac.uk': 'University of Oxford',
  'cam.ac.uk': 'University of Cambridge',
  'imperial.ac.uk': 'Imperial College London',
  'ucl.ac.uk': 'UCL',
  'lse.ac.uk': 'LSE',
  'utoronto.ca': 'University of Toronto',
  'ubc.ca': 'UBC',
  'mcgill.ca': 'McGill University',
  'sydney.edu.au': 'University of Sydney',
  'unimelb.edu.au': 'University of Melbourne',
  'anu.edu.au': 'ANU',
  'ethz.ch': 'ETH Zurich',
  'epfl.ch': 'EPFL',
  'tum.de': 'Technical University of Munich',
  'tsinghua.edu.cn': 'Tsinghua University',
  'pku.edu.cn': 'Peking University',
}

export function detectUniversity(email: string): { domain: string; name: string } | null {
  if (!email || !email.includes('@')) return null
  
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null
  
  const universityName = UNIVERSITY_DOMAINS[domain]
  if (universityName) {
    return { domain, name: universityName }
  }
  
  return null
}

export function isUniversityDomain(email: string): boolean {
  return detectUniversity(email) !== null
}
