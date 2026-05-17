export type StepDetail = {
  step:       number
  label:      string
  status:     'ok' | 'error'
  message?:   string
  request?:   string
  received?:  string
  functions?: string[]
  model?:     string
  method?:    string
  constants?: string[]
}

export type WeightSet = {
  intercept: number
  temp:      number
  humidity:  number
  rainfall:  number
}

export type TrainingInfo = {
  trainSize:        number
  testSize:         number
  learnedWeights:   WeightSet   // 정규방정식
  gdWeights:        WeightSet   // 경사하강법 (lr=0.1)
  referenceWeights: { temp: number; humidity: number; rainfall: number }
  trainMSE:         number
  gdTrainMSE:       number
  testMSE:          number
}

export type LossCurve = {
  lr:   number
  data: number[]   // 30 에폭마다 기록한 MSE
}

export type TrainingSample = {
  date:        string
  temp:        number
  humidity:    number
  rainfall:    number
  label:       number
  predicted:   number   // 정규방정식 예측
  gdPredicted: number   // 경사하강법 예측
}

export type ApiResult = {
  steps:          StepDetail[]
  weather:        { temp: number; humidity: number; rainfall: number }
  efficiency:     number
  action:         string
  base_date:      string
  base_time:      string
  training:       TrainingInfo
  lossCurves:     LossCurve[]
  chartData:      { label: string; learned: number; reference: number }[]
  predChart:      { date: string; actual: number; predicted: number }[]
  trainSamples:   TrainingSample[]
  testSamples:    TrainingSample[]
  error?:         string
}
