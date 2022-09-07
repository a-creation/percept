# Solana Fork Visualizer

https://user-images.githubusercontent.com/60591313/188803144-0fe6afbd-40aa-40c0-ad08-d0b0714aebf0.mov

## How to start the app:

Make sure your instance of InfluxDB is runnning and that you have set up your .env file to reflect the endpoints you want this app to use and the validator pubkey that you are running fork-vis on.

Then in this directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

## How it works:

By running core Solana code with fork-vis functionality on a validator, you will begin to post data points to Influx that allow this fork visualizer application to peer into the state of the chain at any point in time. From there, you can replay the state of the network by hitting the play button and, for any point in time, you can see validators' voting history and the stake weight allotted to each fork tip. 


### Features:

- Correlates network time to human readable time using InfluxDB
- Allows user to go back to any point in time to see chain state
- Shows a particular validator's voting history as well as their perception of how voting is going (via fork stake weight)
- General visualization of bank_forks structure for a particular validator


### To Dos:

- Run fork-vis code on a separate thread on fork-vis Solana core branch
- Update validator voting history and fork stake weights upon replay of graph
- Stability testing of both app and core code
