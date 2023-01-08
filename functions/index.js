const functions = require("firebase-functions");

const admin = require("firebase-admin");
const { firestore, database } = require("firebase-admin");
const { ref } = require("firebase-functions/v1/database");
admin.initializeApp();

function uniqueid(num) {

  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let autoId = '';
  for (let i = 0; i < num; i++) {
    autoId += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return autoId;
}
function topUpPayload({ date, mAmountPaid, mReceipt, balance }) {
  var data = {
    notification: {
      title: "EATz wallet",
      body: `${mReceipt} Confirmed. Ksh. ${mAmountPaid}.00 sent to Eatz Co. for Wallet top up. new Wallet balance is Ksh. ${balance + mAmountPaid}.00, Thank you for using eatz. Time: ${(date.getHours() + 3) >= 12 ? (date.getHours() - 9) : date.getHours() + 3}:${date.getMinutes().toString().length == 1 ? `0${date.getMinutes()}` : date.getMinutes()} ${(date.getHours() + 3) >= 12 ? 'PM' : 'AM'} ${date.getDate()}/${date.getMonth()}/${date.getFullYear()}`,
      sound: "default",
    },
    data: {
      click_action: "FLUTTER_NOTIFICATION_CLICK",
      message: `${mReceipt} Confirmed. Ksh. ${mAmountPaid}.00 sent to Eatz Co. for Wallet top up. new Wallet balance is Ksh. ${balance + mAmountPaid}.00, Thank you for using eatz. Time: ${(date.getHours() + 3) >= 12 ? (date.getHours() - 9) : date.getHours() + 3}:${date.getMinutes().toString().length == 1 ? `0${date.getMinutes()}` : date.getMinutes()} ${(date.getHours() + 3) >= 12 ? 'PM' : 'AM'} ${date.getDate()}/${date.getMonth()}/${date.getFullYear()}`,
    },
  };
  return data;
}


async function loadData({ queryResult, mEntryDetails, mAmountPaid, mReceipt }) {
  var documentMatchingID = (await queryResult).docs[0];
  console.log('matching doc: ', documentMatchingID.ref.path);

  const userId = documentMatchingID.ref.path.split('/')[1];

  var user = admin.firestore().collection('vs_users').doc(userId);
  var userData = await user.get();
  var token = userData.data().deviceToken;
  var dateTime = admin.firestore.Timestamp.fromDate(new Date());
  var date = dateTime.toDate();
  var data = {};
  await admin.firestore().runTransaction(async (t) => {
    return await t.get(user.collection('wallet').doc('account')).then(async (doc) => {

      if (doc.exists) {
        console.log(doc.data());
        var balance = doc.data().balance;
        var newBalance = firestore.FieldValue.increment(mAmountPaid);
        console.log(doc.ref.path);
        console.log('balance', balance);
        console.log('new balance', newBalance);


        t.set(doc.ref, {
          'balance': newBalance,
          'currency': 'KES',
          'lastTransacted': dateTime
        }, { merge: true });

      } else {
        t.set(user.collection('wallet').doc('account'), {
          'balance': mAmountPaid,
          'currency': 'KES',
          'lastTransacted': dateTime
        });
      }
      t.update(documentMatchingID.ref, mEntryDetails);
      t.set(user.collection('transactions').doc(mReceipt), {
        'amount': mAmountPaid,
        'currency': 'KES',
        'date': dateTime,
        'id': mReceipt,
        'particulars': 'Account Deposit',
        'recipient': {
          'institution': 'Eatz Co.',
          'shop': 'Wallet top up',
        },
        'type': 'dr'
      });
      data = topUpPayload({ date: date, mAmountPaid: mAmountPaid, mReceipt: mReceipt, balance: balance??0 })


    });
  }).then(async () => {
    await admin.messaging().sendToDevice(token, data);
  });


}


exports.b2b_callback_endpoint = functions.https.onRequest(async (req, res) => {
  //get stk response body
  const callbackData = req.body;

  console.log("received payload: ", callbackData);
  await firestore().collection('b2btest').doc().set(callbackData);
});

exports.testTransaction = functions.firestore
  .document("/newReceipts/{id}")
  .onCreate(async (snap, context) => {
    try {

      var update = true;
      var failMeal = '';
      await firestore().runTransaction(async (t) => {
        const val = snap.data();
        const docID = context.params.id;
        const value = Object.values(val.map);
        const key = Object.keys(val.map);

        function generateUniqueFirestoreId() {
          const chars = "abcdefghjklmnpqrstuvwxyz23456789";

          let autoId = "";
          for (let i = 0; i < 6; i++) {
            autoId += chars.charAt(Math.floor(Math.random() * chars.length));
          }

          return autoId;
        }

        const passkey = generateUniqueFirestoreId();

        var token = val.token;
        var notify =
          "hey😎 " +
          val.message +
          "for " +
          key +
          `  use code  ${passkey} at the cashier to claim your purchase 🤑`;
        var payload = {
          notification: { title: "EATz😋", body: notify, sound: "default" },
          data: {
            click_action: "FLUTTER_NOTIFICATION_CLICK",
            message: `purchase for ${key} has been confirmed 🤤`,
          },
        };

        for (let index = 0; index < value.length; index++) {
          var mealDoc = admin
            .firestore()
            .collection("inst")
            .doc(val.inst)
            .collection("items")
            .doc(key[index]);

          var mealData = mealDoc.get();

          var mealName = (await mealData).data().name;
          var remaining = (await mealData).data().quantity;
          var price = (await mealData).data().price;
          var quantityPurchased = value[index];
          var newQuantity = remaining - quantityPurchased;





          var accBal = admin.firestore().collection('payments').doc(val.user).collection(val.inst).doc('receipt').collection('balance').doc('account').get();
          var initBal = await (await accBal).get('wallet');
          var newBal;// = initBal - (val.total+1);
          if (val.total <= 55) {
            newBal = initBal - (val.total + 1);
          } else if (val.total > 55 && val.total < 120) {
            newBal = initBal - (val.total + 2);
          } else if (val.total > 120 && val.total < 190) {
            newBal = initBal - (val.total + 4);
          } else if (val.total > 190) {
            newBal = initBal - (val.total + 6);
          }
          if (initBal != null) {
            await admin.firestore().collection('payments').doc(val.user).collection(val.inst).doc('receipt').collection('balance').doc('account').update({ 'wallet': newBal });
          } else {
            console.log('user has no wallet')
          }






          if (remaining > quantityPurchased) {
            // update = true;
            // t.update(mealDoc,{'quantity':newQuantity});
            // console.log(mealName+' updated with Quantity '+ newQuantity);
          } else {
            failMeal = mealName;
            update = false;
            console.log("this won't work");
          }
        }
        var failedPayload = {
          notification: {
            title: "EATz",
            body: `purchase for ${key} has failed because ${failMeal} ran out 😢 please try again`,
            sound: "default",
          },
          data: {
            click_action: "FLUTTER_NOTIFICATION_CLICK",
            message: `purchase for ${key} has failed because ${failMeal} ran out 😢 please try again`,
          },
        };
        console.log(update);
        if (update) {
          for (let i = 0; i < value.length; i++) {
            var mealDoc = admin
              .firestore()
              .collection("inst")
              .doc(val.inst)
              .collection("items")
              .doc(key[i]);
            var mealData = mealDoc.get();
            var mealName = (await mealData).data().name;
            var remaining = (await mealData).data().quantity;
            var price = (await mealData).data().price;
            var quantityPurchased = value[i];
            var newQuantity = remaining - quantityPurchased;
            t.update(mealDoc, { quantity: newQuantity });

            console.log(
              mealName +
              " worth ksh " +
              price +
              " updated with quantity " +
              newQuantity
            );
          }
          await admin.messaging().sendToDevice(token, payload);
          await admin.firestore().collection('newReceipts').doc(docID).set({ 'receiptNumber': passkey, 'paid': true, 'checkedOut': false }, { merge: true });

        } else {

          console.log("we could not complete this purchase");
          await admin.messaging().sendToDevice(token, failedPayload).then((_) => {
            snap.ref.delete();
          });
        }
      });
    } catch (e) {
      console.log("Transaction failure:", e);
    }
  });

// exports.loadWallet = functions.firestore.document('vs_users/{id}/deposits/{}')
exports.loadWallet = functions.https.onRequest(async (req, res) => {
  const callbackData = req.body.Body.stkCallback;
  const responseCode = callbackData.ResultCode;
  const mCheckoutRequestID = callbackData.CheckoutRequestID;
  console.log(callbackData.CallbackMetadata);
  if (responseCode === 0) {
    const details = callbackData.CallbackMetadata.Item;

    var mReceipt;
    var mPhonePaidFrom;
    var mAmountPaid
    var mTransactionDate;

    await details.forEach(entry => {
      switch (entry.Name) {
        case 'MpesaReceiptNumber':
          mReceipt = entry.Value
          break;

        case 'PhoneNumber':
          mPhonePaidFrom = entry.Value
          break;

        case 'Amount':
          mAmountPaid = entry.Value
          break;

        case 'TransactionDate':
          mTransactionDate = entry.Value
          break;

        default:
          break;
      }
    });

    const mEntryDetails = {
      'receipt': mReceipt,
      'phone': mPhonePaidFrom,
      'amount': mAmountPaid,
      'date': mTransactionDate
    }
    const lost_found_receipts = {
      'CheckoutRequestID': mCheckoutRequestID,
      'receipt': mReceipt,
      'phone': mPhonePaidFrom,
      'amount': mAmountPaid,
      'date': mTransactionDate
    }
    //find the document initialized from the client device containing the checkoutRequestID

    var matchingCheckoutID = admin.firestore().collectionGroup('deposit').where('CheckoutRequestID', '==', mCheckoutRequestID);
    const queryResult = matchingCheckoutID.get();

    if (!(await queryResult).empty) {
      loadData({
        queryResult: queryResult,
        mEntryDetails: mEntryDetails,
        mAmountPaid: mAmountPaid, 
        mReceipt: mReceipt
      });

    } else {
      console.log('no document found matching the checkoutRequestID: ', mCheckoutRequestID);
      //persist the data somewhere for reference.

      admin.firestore().collection('vsLostFoundReceipts').doc(mCheckoutRequestID).set(lost_found_receipts);

    }
  } else {
    console.log('failed transaction');
    admin.firestore().collection('failedTransactions').doc(mCheckoutRequestID).set(callbackData);

  }
  console.log('something');
  res.json({ 'result': `payment for ${mCheckoutRequestID} response received.` });
});